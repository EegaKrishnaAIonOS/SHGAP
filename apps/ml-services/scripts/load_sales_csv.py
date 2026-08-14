"""Loads a real multi-year sales-history CSV into the `sales` table, mapping
CSV columns (Order_Date, Product_ID, Product_Name, Category, District,
SHG_Name, Sales_Channel, Quantity, Unit_Price, Discount, Sales_Amount) onto
the `SaleRecord` shape T14/T15 expect (product_id, shg_id, district_id,
category_id, quantity, unit_price, total_amount, sale_date). `Sales_Channel`
and `Discount` aren't part of that shape and are read but otherwise ignored —
`Sales_Amount` is trusted as the real observed revenue for `total_amount`
rather than re-derived from quantity/price/discount.

This is (as far as this project has ever had) the first *real* sales
history — previously the only data in `sales` was demo-sales.ts's ~180-day
synthetic seed (see ADR-0023). Referenced districts/categories/SHGs/products
are looked up by natural key (name) and created the first time this loader
sees them, since almost none of them will already exist.

Known gaps in what gets created, stated rather than fabricated:
  - New SHGs/products get `location = NULL` — the CSV carries no lat/lng.
    H3 geo features (`feature_engineering.add_geo_features`) and hotspots
    already handle a null location by skipping the row; nothing crashes,
    it's simply not geo-located.
  - A new SHG needs a `contact_user_id` (NOT NULL); one placeholder User is
    created per new SHG with a deterministic fake phone number (derived
    from the SHG name + district, not random, so re-running this script is
    traceable) — there is no real registration/login behind these SHGs.
  - A new SHG's `type` is a best-effort guess from its first product's
    category (see `_infer_shg_type`), defaulting to HOME_BASED_ENTERPRISE.
    The CSV has no SHG-type field to read this from directly.
  - New categories are created flat (no parent) — the CSV has no category
    hierarchy, only a flat Category string.
  - Product `unit` defaults to the literal string "unit" — not present in
    the CSV at all.
  - Product `price` (catalog reference price, distinct from each sale's own
    `unit_price`) is the mean Unit_Price across that product's own rows.

Also seeds `festival_calendar` with real AP festival dates (Sankranti,
Ugadi, Ganesh Chaturthi, Dasara, Diwali) for every calendar year the CSV's
Order_Date column actually covers — see REAL_AP_FESTIVALS below. This
matters beyond documentation: `feature_engineering.add_festival_features`
matches sales rows against literal `festival_calendar` start/end dates, it
does not itself expand a `recurring=true` row to other years, so a festival
row seeded for one year is invisible to sales in every other year.

Usage:
    python scripts/load_sales_csv.py path/to/sales_history.csv [--dry-run]
"""

import argparse
import asyncio
import hashlib
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import psycopg
import psycopg.rows

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.config import settings  # noqa: E402

REQUIRED_COLUMNS = [
    "Order_Date",
    "Product_ID",
    "Product_Name",
    "Category",
    "District",
    "SHG_Name",
    "Quantity",
    "Unit_Price",
    "Sales_Amount",
]

# Real, dated (not "recurring") AP festival occurrences — sourced from
# DrikPanchang/public holiday references, not guessed. Sankranti is a solar
# festival (fixed Jan 14-16 every year); the other four are lunar and shift
# year to year, so each year needs its own looked-up date. Extend this table
# (from an authoritative Panchang source, not a guess) before loading a CSV
# whose date range falls outside it.
REAL_AP_FESTIVALS: dict[int, list[tuple[str, str, str]]] = {
    2020: [
        ("Sankranti", "2020-01-14", "2020-01-16"),
        ("Ugadi", "2020-03-25", "2020-03-25"),
        ("Ganesh Chaturthi", "2020-08-22", "2020-08-22"),
        ("Dasara / Vijayadashami", "2020-10-25", "2020-10-25"),
        ("Diwali", "2020-11-14", "2020-11-14"),
    ],
    2021: [
        ("Sankranti", "2021-01-14", "2021-01-16"),
        ("Ugadi", "2021-04-13", "2021-04-13"),
        ("Ganesh Chaturthi", "2021-09-10", "2021-09-10"),
        ("Dasara / Vijayadashami", "2021-10-15", "2021-10-15"),
        ("Diwali", "2021-11-04", "2021-11-04"),
    ],
    2022: [
        ("Sankranti", "2022-01-14", "2022-01-16"),
        ("Ugadi", "2022-04-02", "2022-04-02"),
        ("Ganesh Chaturthi", "2022-08-31", "2022-08-31"),
        ("Dasara / Vijayadashami", "2022-10-05", "2022-10-05"),
        ("Diwali", "2022-10-24", "2022-10-24"),
    ],
    2023: [
        ("Sankranti", "2023-01-14", "2023-01-16"),
        ("Ugadi", "2023-03-22", "2023-03-22"),
        ("Ganesh Chaturthi", "2023-09-19", "2023-09-19"),
        ("Dasara / Vijayadashami", "2023-10-24", "2023-10-24"),
        ("Diwali", "2023-11-12", "2023-11-12"),
    ],
    2024: [
        ("Sankranti", "2024-01-14", "2024-01-16"),
        ("Ugadi", "2024-04-09", "2024-04-09"),
        ("Ganesh Chaturthi", "2024-09-07", "2024-09-07"),
        ("Dasara / Vijayadashami", "2024-10-12", "2024-10-12"),
        ("Diwali", "2024-11-01", "2024-11-01"),
    ],
    2025: [
        ("Sankranti", "2025-01-14", "2025-01-16"),
        ("Ugadi", "2025-03-30", "2025-03-30"),
        ("Ganesh Chaturthi", "2025-08-27", "2025-08-27"),
        ("Dasara / Vijayadashami", "2025-10-02", "2025-10-02"),
        ("Diwali", "2025-10-20", "2025-10-20"),
    ],
    2026: [
        ("Sankranti", "2026-01-14", "2026-01-16"),
        ("Ugadi", "2026-03-19", "2026-03-19"),
        ("Ganesh Chaturthi", "2026-09-14", "2026-09-14"),
        ("Dasara / Vijayadashami", "2026-10-20", "2026-10-20"),
        ("Diwali", "2026-11-08", "2026-11-08"),
    ],
    2027: [
        ("Sankranti", "2027-01-14", "2027-01-16"),
        ("Ugadi", "2027-04-07", "2027-04-07"),
        ("Ganesh Chaturthi", "2027-09-04", "2027-09-04"),
        ("Dasara / Vijayadashami", "2027-10-09", "2027-10-09"),
        ("Diwali", "2027-10-29", "2027-10-29"),
    ],
}

# Keyword -> ShgType, matched against a slugified category name. Mirrors the
# five product ecosystems in database/seed/data.ts's category taxonomy.
_SHG_TYPE_KEYWORDS: list[tuple[str, str]] = [
    ("pickle", "FOOD"),
    ("snack", "FOOD"),
    ("namkeen", "FOOD"),
    ("spice", "FOOD"),
    ("masala", "FOOD"),
    ("millet", "FOOD"),
    ("food", "FOOD"),
    ("bamboo", "HANDICRAFTS"),
    ("terracotta", "HANDICRAFTS"),
    ("pottery", "HANDICRAFTS"),
    ("leather", "HANDICRAFTS"),
    ("jute", "HANDICRAFTS"),
    ("handicraft", "HANDICRAFTS"),
    ("handloom", "HANDLOOM"),
    ("saree", "HANDLOOM"),
    ("ikat", "HANDLOOM"),
    ("textile", "HANDLOOM"),
    ("cotton", "HANDLOOM"),
    ("organic", "AGRICULTURE_ALLIED"),
    ("vegetable", "AGRICULTURE_ALLIED"),
    ("dairy", "AGRICULTURE_ALLIED"),
    ("honey", "AGRICULTURE_ALLIED"),
    ("bee", "AGRICULTURE_ALLIED"),
    ("agri", "AGRICULTURE_ALLIED"),
    ("tailoring", "HOME_BASED_ENTERPRISE"),
    ("garment", "HOME_BASED_ENTERPRISE"),
    ("candle", "HOME_BASED_ENTERPRISE"),
    ("soap", "HOME_BASED_ENTERPRISE"),
    ("papad", "HOME_BASED_ENTERPRISE"),
]
DEFAULT_SHG_TYPE = "HOME_BASED_ENTERPRISE"


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")


def _infer_shg_type(category_name: str) -> str:
    slug = _slugify(category_name)
    for keyword, shg_type in _SHG_TYPE_KEYWORDS:
        if keyword in slug:
            return shg_type
    return DEFAULT_SHG_TYPE


def _placeholder_phone(seed: str) -> str:
    """A deterministic, obviously-fake phone number for a placeholder
    contact User — same seed always produces the same number, so re-running
    the loader against the same CSV is traceable rather than spawning a
    fresh throwaway user every time."""
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return "7" + str(int(digest[:12], 16))[:9].zfill(9)


def _load_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"CSV is missing required column(s): {missing}")

    df["Order_Date"] = pd.to_datetime(df["Order_Date"])
    for col in ("Quantity", "Unit_Price", "Sales_Amount"):
        df[col] = pd.to_numeric(df[col])
    for col in ("Product_ID", "Product_Name", "Category", "District", "SHG_Name"):
        df[col] = df[col].astype(str).str.strip()
    return df


async def _get_or_create_district(cur, cache: dict, name: str) -> str:
    if name in cache:
        return cache[name]

    await cur.execute("SELECT id FROM districts WHERE name = %s", (name,))
    row = await cur.fetchone()
    if row:
        cache[name] = str(row["id"])
        return cache[name]

    await cur.execute("SELECT code FROM districts")
    existing_codes = {r["code"] for r in await cur.fetchall()}
    base = re.sub(r"[^A-Z]", "", name.upper())[:3] or "DST"
    code = base
    suffix = 1
    while code in existing_codes:
        suffix += 1
        code = f"{base}{suffix}"[:10]

    new_id = str(uuid.uuid4())
    await cur.execute(
        "INSERT INTO districts (id, name, code) VALUES (%s, %s, %s)", (new_id, name, code)
    )
    cache[name] = new_id
    return new_id


async def _get_or_create_category(cur, cache: dict, name: str) -> str:
    slug = _slugify(name)
    if slug in cache:
        return cache[slug]

    await cur.execute("SELECT id FROM categories WHERE slug = %s", (slug,))
    row = await cur.fetchone()
    if row:
        cache[slug] = str(row["id"])
        return cache[slug]

    new_id = str(uuid.uuid4())
    await cur.execute(
        "INSERT INTO categories (id, name, slug) VALUES (%s, %s, %s)", (new_id, name, slug)
    )
    cache[slug] = new_id
    return new_id


async def _get_or_create_shg(
    cur, cache: dict, name: str, district_id: str, district_name: str, category_name: str
) -> str:
    key = (name, district_id)
    if key in cache:
        return cache[key]

    await cur.execute(
        "SELECT id FROM shg WHERE name = %s AND district_id = %s", (name, district_id)
    )
    row = await cur.fetchone()
    if row:
        cache[key] = str(row["id"])
        return cache[key]

    now = datetime.now(timezone.utc)
    user_id = str(uuid.uuid4())
    phone = _placeholder_phone(f"{name}:{district_name}")
    await cur.execute(
        "INSERT INTO users (id, phone, name, updated_at) VALUES (%s, %s, %s, %s)",
        (user_id, phone, f"{name} Contact", now),
    )

    shg_id = str(uuid.uuid4())
    shg_type = _infer_shg_type(category_name)
    await cur.execute(
        """INSERT INTO shg (id, name, type, district_id, contact_user_id, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (shg_id, name, shg_type, district_id, user_id, now),
    )
    cache[key] = shg_id
    return shg_id


async def _get_or_create_product(
    cur, cache: dict, csv_product_id: str, name: str, shg_id: str, category_id: str, price: float
) -> str:
    if csv_product_id in cache:
        return cache[csv_product_id]

    await cur.execute("SELECT id FROM products WHERE name = %s AND shg_id = %s", (name, shg_id))
    row = await cur.fetchone()
    if row:
        cache[csv_product_id] = str(row["id"])
        return cache[csv_product_id]

    product_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await cur.execute(
        """INSERT INTO products (id, shg_id, category_id, name, unit, price, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (product_id, shg_id, category_id, name, "unit", price, now),
    )
    cache[csv_product_id] = product_id
    return product_id


async def seed_festival_calendar(cur, years: set[int]) -> int:
    missing_years = sorted(y for y in years if y not in REAL_AP_FESTIVALS)
    if missing_years:
        raise SystemExit(
            f"No real festival dates on file for year(s) {missing_years} — add them to "
            "REAL_AP_FESTIVALS (from an authoritative Panchang source) rather than guessing "
            "lunar festival dates, then re-run."
        )

    inserted = 0
    for year in sorted(years):
        for name, start, end in REAL_AP_FESTIVALS[year]:
            await cur.execute(
                "SELECT 1 FROM festival_calendar "
                "WHERE name = %s AND start_date = %s AND district_id IS NULL",
                (name, start),
            )
            if await cur.fetchone():
                continue
            await cur.execute(
                """INSERT INTO festival_calendar
                   (id, name, start_date, end_date, recurring, district_id)
                   VALUES (%s, %s, %s, %s, false, NULL)""",
                (str(uuid.uuid4()), name, start, end),
            )
            inserted += 1
    return inserted


async def load(csv_path: Path, dry_run: bool) -> None:
    df = _load_csv(csv_path)
    years = set(df["Order_Date"].dt.year.tolist())

    if dry_run:
        print(f"{len(df)} sale rows parsed from {csv_path}")
        print(f"  date range: {df['Order_Date'].min().date()} to {df['Order_Date'].max().date()}")
        print(f"  years covered: {sorted(years)}")
        print(f"  districts: {df['District'].nunique()}")
        print(f"  categories: {df['Category'].nunique()}")
        print(f"  SHGs: {df['SHG_Name'].nunique()}")
        print(f"  products: {df['Product_ID'].nunique()}")
        missing_years = sorted(y for y in years if y not in REAL_AP_FESTIVALS)
        if missing_years:
            print(f"  WARNING: no real festival dates on file for {missing_years}")
        print("Dry run — nothing written.")
        return

    avg_price_by_product = df.groupby("Product_ID")["Unit_Price"].mean()

    district_cache: dict = {}
    category_cache: dict = {}
    shg_cache: dict = {}
    product_cache: dict = {}
    sale_rows = []

    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute("SELECT count(*) AS n FROM sales")
            existing_sales = (await cur.fetchone())["n"]
            if existing_sales > 0:
                print(
                    f"NOTE: sales table already has {existing_sales} row(s) "
                    "(e.g. from demo-sales.ts's synthetic seed) — this loader only adds rows, "
                    "it does not remove or replace anything."
                )

            for row in df.itertuples(index=False):
                district_id = await _get_or_create_district(cur, district_cache, row.District)
                category_id = await _get_or_create_category(cur, category_cache, row.Category)
                shg_id = await _get_or_create_shg(
                    cur, shg_cache, row.SHG_Name, district_id, row.District, row.Category
                )
                product_id = await _get_or_create_product(
                    cur,
                    product_cache,
                    row.Product_ID,
                    row.Product_Name,
                    shg_id,
                    category_id,
                    float(avg_price_by_product[row.Product_ID]),
                )
                sale_rows.append(
                    (
                        str(uuid.uuid4()),
                        product_id,
                        shg_id,
                        district_id,
                        float(row.Quantity),
                        float(row.Unit_Price),
                        float(row.Sales_Amount),
                        row.Order_Date.date(),
                    )
                )

            await cur.executemany(
                """INSERT INTO sales
                   (id, product_id, shg_id, district_id, quantity, unit_price,
                    total_amount, sale_date)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                sale_rows,
            )

            festivals_inserted = await seed_festival_calendar(cur, years)

        await conn.commit()

    print(f"Loaded {len(sale_rows)} sale rows.")
    print(f"  districts touched: {len(district_cache)}")
    print(f"  categories touched: {len(category_cache)}")
    print(f"  SHGs touched: {len(shg_cache)}")
    print(f"  products touched: {len(product_cache)}")
    print(f"  festival_calendar rows inserted: {festivals_inserted} (for years {sorted(years)})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path, help="Path to the sales history CSV")
    parser.add_argument(
        "--dry-run", action="store_true", help="Parse and summarize the CSV without writing"
    )
    args = parser.parse_args()

    if not args.csv_path.exists():
        raise SystemExit(f"No such file: {args.csv_path}")

    asyncio.run(load(args.csv_path, args.dry_run))


if __name__ == "__main__":
    main()
