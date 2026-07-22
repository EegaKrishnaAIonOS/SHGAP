from dataclasses import dataclass

import psycopg
import psycopg.rows

from app.config import settings


@dataclass(frozen=True)
class SaleRecord:
    id: str
    product_id: str
    shg_id: str
    district_id: str
    category_id: str
    quantity: float
    unit_price: float
    total_amount: float
    sale_date: str  # ISO date string, e.g. "2026-03-01"
    lng: float | None
    lat: float | None


@dataclass(frozen=True)
class EnquiryRecord:
    id: str
    buyer_id: str
    product_id: str | None
    shg_id: str
    status: str
    created_at: str  # ISO datetime string


@dataclass(frozen=True)
class ProductRecord:
    id: str
    shg_id: str
    category_id: str
    district_id: str
    name: str
    price: float
    lng: float | None
    lat: float | None


@dataclass(frozen=True)
class FestivalRecord:
    name: str
    start_date: str  # ISO date string
    end_date: str
    district_id: str | None


async def fetch_sales(database_url: str = settings.database_url) -> list[SaleRecord]:
    """All sales to date — this table is currently tiny/empty in a fresh
    environment (no real e-commerce checkout flow exists yet), so the seed
    script's synthetic sales history (see database/seed/demo-sales.ts) is
    what gives this pipeline something real to compute features over. See
    ADR-0023."""
    query = """
        SELECT s.id, s.product_id, s.shg_id, s.district_id, p.category_id,
               s.quantity, s.unit_price, s.total_amount, s.sale_date,
               ST_X(p.location) AS lng, ST_Y(p.location) AS lat
        FROM sales s
        JOIN products p ON p.id = s.product_id
        ORDER BY s.sale_date
    """
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [
        SaleRecord(
            id=str(row["id"]),
            product_id=str(row["product_id"]),
            shg_id=str(row["shg_id"]),
            district_id=str(row["district_id"]),
            category_id=str(row["category_id"]),
            quantity=float(row["quantity"]),
            unit_price=float(row["unit_price"]),
            total_amount=float(row["total_amount"]),
            sale_date=row["sale_date"].isoformat(),
            lng=float(row["lng"]) if row["lng"] is not None else None,
            lat=float(row["lat"]) if row["lat"] is not None else None,
        )
        for row in rows
    ]


async def fetch_enquiries(database_url: str = settings.database_url) -> list[EnquiryRecord]:
    query = """
        SELECT id, buyer_id, product_id, shg_id, status, created_at
        FROM enquiries
        ORDER BY created_at
    """
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [
        EnquiryRecord(
            id=str(row["id"]),
            buyer_id=str(row["buyer_id"]),
            product_id=str(row["product_id"]) if row["product_id"] else None,
            shg_id=str(row["shg_id"]),
            status=row["status"],
            created_at=row["created_at"].isoformat(),
        )
        for row in rows
    ]


async def fetch_products(database_url: str = settings.database_url) -> list[ProductRecord]:
    query = """
        SELECT p.id, p.shg_id, p.category_id, s.district_id, p.name, p.price,
               ST_X(p.location) AS lng, ST_Y(p.location) AS lat
        FROM products p
        JOIN shg s ON s.id = p.shg_id
    """
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [
        ProductRecord(
            id=str(row["id"]),
            shg_id=str(row["shg_id"]),
            category_id=str(row["category_id"]),
            district_id=str(row["district_id"]),
            name=row["name"],
            price=float(row["price"]),
            lng=float(row["lng"]) if row["lng"] is not None else None,
            lat=float(row["lat"]) if row["lat"] is not None else None,
        )
        for row in rows
    ]


async def fetch_festivals(database_url: str = settings.database_url) -> list[FestivalRecord]:
    query = """
        SELECT name, start_date, end_date, district_id
        FROM festival_calendar
        ORDER BY start_date
    """
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [
        FestivalRecord(
            name=row["name"],
            start_date=row["start_date"].isoformat(),
            end_date=row["end_date"].isoformat(),
            district_id=str(row["district_id"]) if row["district_id"] else None,
        )
        for row in rows
    ]
