import uuid
from dataclasses import dataclass

import numpy as np
import psycopg
import psycopg.rows

from app.config import settings


@dataclass(frozen=True)
class SchemeChunkResult:
    scheme_name: str
    content: str
    source_url: str
    source_title: str
    # Cosine similarity, 0-1 (clamped) — see `search_similar_chunks`.
    score: float


def _vector_literal(embedding: np.ndarray) -> str:
    """pgvector's text input format, e.g. "[0.1,0.2,0.3]" — there's no
    `pgvector` Python adapter installed (see requirements.txt; ml-services
    only needed raw reads until this task), so embeddings are passed as a
    plain string and cast with `::vector` in the SQL itself."""
    return "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"


async def replace_all_chunks(
    chunks: list[tuple[str, str, str, str, np.ndarray]],
    database_url: str = settings.database_url,
) -> int:
    """Wipes and reloads the entire `scheme_chunks` table from the given
    (scheme_name, content, source_url, source_title, embedding) tuples.
    A full replace, not an upsert, is deliberate: the seed content in
    `content.py` is small and hand-curated, so re-running ingestion after an
    edit should make the table match the source file exactly rather than
    accumulate stale rows from a previous run."""
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM scheme_chunks")
            for scheme_name, content, source_url, source_title, embedding in chunks:
                await cur.execute(
                    """
                    INSERT INTO scheme_chunks
                        (id, scheme_name, content, source_url, source_title, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s::vector)
                    """,
                    (
                        str(uuid.uuid4()),
                        scheme_name,
                        content,
                        source_url,
                        source_title,
                        _vector_literal(embedding),
                    ),
                )
        await conn.commit()
    return len(chunks)


async def search_similar_chunks(
    query_embedding: np.ndarray,
    top_k: int,
    database_url: str = settings.database_url,
) -> list[SchemeChunkResult]:
    """Cosine-similarity search over `scheme_chunks` via pgvector's `<=>`
    (cosine distance) operator — `1 - distance` converts it to a similarity
    score, matching the convention `categorization/service.py` already uses."""
    query = """
        SELECT scheme_name, content, source_url, source_title,
               1 - (embedding <=> %s::vector) AS score
        FROM scheme_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """
    vector_literal = _vector_literal(query_embedding)
    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(query, (vector_literal, vector_literal, top_k))
            rows = await cur.fetchall()

    return [
        SchemeChunkResult(
            scheme_name=row["scheme_name"],
            content=row["content"],
            source_url=row["source_url"],
            source_title=row["source_title"],
            score=max(0.0, min(1.0, float(row["score"]))),
        )
        for row in rows
    ]
