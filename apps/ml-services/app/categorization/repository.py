from dataclasses import dataclass

import psycopg
import psycopg.rows

from app.config import settings


@dataclass(frozen=True)
class CategoryRecord:
    id: str
    name: str
    slug: str
    parent_id: str | None
    parent_name: str | None


async def fetch_categories(database_url: str = settings.database_url) -> list[CategoryRecord]:
    """Reads the full category taxonomy directly from Postgres (ml-services
    connects straight to the DB per the T01 container diagram) — a live read,
    not a hardcoded copy, so taxonomy edits need no ml-services redeploy."""
    query = """
        SELECT c.id, c.name, c.slug, c.parent_id, p.name AS parent_name
        FROM categories c
        LEFT JOIN categories p ON p.id = c.parent_id
        ORDER BY c.name
    """
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query)
            rows = await cur.fetchall()

    return [
        CategoryRecord(
            id=str(row["id"]),
            name=row["name"],
            slug=row["slug"],
            parent_id=str(row["parent_id"]) if row["parent_id"] else None,
            parent_name=row["parent_name"],
        )
        for row in rows
    ]
