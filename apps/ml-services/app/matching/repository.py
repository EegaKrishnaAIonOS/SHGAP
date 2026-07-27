from dataclasses import dataclass, field

import psycopg
import psycopg.rows

from app.config import settings


@dataclass(frozen=True)
class ProductRecord:
    id: str
    shg_id: str
    category_id: str
    category_name: str
    district_id: str
    name: str
    description: str | None
    price: float
    moq: int
    stock: int
    is_available: bool
    lng: float | None
    lat: float | None


@dataclass(frozen=True)
class BuyerRecord:
    id: str
    name: str
    type: str
    organization: str | None
    district_id: str | None
    demand_profile: dict | None
    category_ids: list[str] = field(default_factory=list)
    category_names: list[str] = field(default_factory=list)
    lng: float | None = None
    lat: float | None = None


async def fetch_products(database_url: str = settings.database_url) -> list[ProductRecord]:
    """Only available products — an out-of-stock/disabled product shouldn't
    be recommended to a buyer regardless of how well it matches."""
    query = """
        SELECT p.id, p.shg_id, p.category_id, c.name AS category_name, s.district_id,
               p.name, p.description, p.price, p.moq, p.stock, p.is_available,
               ST_X(p.location) AS lng, ST_Y(p.location) AS lat
        FROM products p
        JOIN shg s ON s.id = p.shg_id
        JOIN categories c ON c.id = p.category_id
        WHERE p.is_available = true
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
            category_name=row["category_name"],
            district_id=str(row["district_id"]),
            name=row["name"],
            description=row["description"],
            price=float(row["price"]),
            moq=int(row["moq"]),
            stock=int(row["stock"]),
            is_available=bool(row["is_available"]),
            lng=float(row["lng"]) if row["lng"] is not None else None,
            lat=float(row["lat"]) if row["lat"] is not None else None,
        )
        for row in rows
    ]


async def fetch_products_for_shg(
    shg_id: str, database_url: str = settings.database_url
) -> list[ProductRecord]:
    all_products = await fetch_products(database_url)
    return [p for p in all_products if p.shg_id == shg_id]


async def fetch_buyers(database_url: str = settings.database_url) -> list[BuyerRecord]:
    query = """
        SELECT b.id, b.name, b.type, b.organization, b.district_id, b.demand_profile,
               ST_X(b.location) AS lng, ST_Y(b.location) AS lat,
               COALESCE(array_agg(bci.category_id)
                        FILTER (WHERE bci.category_id IS NOT NULL), '{}') AS category_ids,
               COALESCE(array_agg(c.name)
                        FILTER (WHERE c.name IS NOT NULL), '{}') AS category_names
        FROM buyers b
        LEFT JOIN buyer_category_interests bci ON bci.buyer_id = b.id
        LEFT JOIN categories c ON c.id = bci.category_id
        GROUP BY b.id
    """
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [
        BuyerRecord(
            id=str(row["id"]),
            name=row["name"],
            type=row["type"],
            organization=row["organization"],
            district_id=str(row["district_id"]) if row["district_id"] else None,
            demand_profile=row["demand_profile"],
            category_ids=[str(c) for c in row["category_ids"]],
            category_names=list(row["category_names"]),
            lng=float(row["lng"]) if row["lng"] is not None else None,
            lat=float(row["lat"]) if row["lat"] is not None else None,
        )
        for row in rows
    ]


@dataclass(frozen=True)
class RecommendationFeedbackRecord:
    """One historical recommendation with a real accept/reject outcome —
    the (features, label) pairs a real ranker can eventually train on.
    `components` is the exact sub-score feature vector that was actually
    shown to the SHG at recommendation time (stored in `reasons.components`
    by core-api when the recommendation was created), not recomputed after
    the fact — recomputing risks feature drift if prices/interests changed
    since."""

    components: dict
    accepted: bool


async def fetch_recommendation_feedback(
    database_url: str = settings.database_url,
) -> list[RecommendationFeedbackRecord]:
    query = """
        SELECT status, reasons
        FROM recommendations
        WHERE status IN ('ACCEPTED', 'REJECTED') AND reasons -> 'components' IS NOT NULL
    """
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [
        RecommendationFeedbackRecord(
            components=row["reasons"]["components"],
            accepted=row["status"] == "ACCEPTED",
        )
        for row in rows
    ]


async def fetch_embeddings(
    table: str, ids: list[str], database_url: str = settings.database_url
) -> dict[str, list[float] | None]:
    """Reads back `embedding::text` (pgvector's own textual form, e.g.
    "[0.1,0.2,...]") rather than registering a custom type adapter — matches
    this codebase's established "raw SQL, manual parsing" convention
    (GeoService's ST_X/ST_Y). Missing ids or a NULL embedding both map to
    `None`, so the caller can tell "not yet computed" from "computed"."""
    if table not in ("products", "buyers"):
        raise ValueError(f"Unexpected table {table!r}")
    if not ids:
        return {}

    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(
                f"SELECT id, embedding::text AS embedding FROM {table} WHERE id = ANY(%s::uuid[])",
                (ids,),
            )
            rows = await cur.fetchall()

    result: dict[str, list[float] | None] = {entity_id: None for entity_id in ids}
    for row in rows:
        if row["embedding"] is not None:
            result[str(row["id"])] = [float(v) for v in row["embedding"].strip("[]").split(",")]
    return result


async def write_embeddings(
    table: str, embeddings: dict[str, list[float]], database_url: str = settings.database_url
) -> None:
    """Writes computed embeddings back to `products.embedding` or
    `buyers.embedding` (both `vector(384)`, see ADR-0026). `table` is a
    hardcoded caller-controlled literal (never user input), matching
    core-api's GeoService raw-SQL convention for the same reason: Prisma/
    psycopg can't parameterize a table name."""
    if table not in ("products", "buyers"):
        raise ValueError(f"Unexpected table {table!r}")

    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor() as cur:
            for entity_id, vector in embeddings.items():
                vector_literal = "[" + ",".join(str(v) for v in vector) + "]"
                await cur.execute(
                    f"UPDATE {table} SET embedding = %s::vector WHERE id = %s::uuid",
                    (vector_literal, entity_id),
                )
        await conn.commit()
