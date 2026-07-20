"""Embeds `app.scheme_guidance.content.SCHEME_CHUNKS` and loads them into the
`scheme_chunks` pgvector table (T12). Run manually after editing the seed
content — not part of app startup or CI, since it does a real embedding-model
load and a real DB write:

    python scripts/ingest_scheme_chunks.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Same Windows event-loop fix as app/main.py — psycopg's async mode needs the
# selector loop, not asyncio's default ProactorEventLoop, on Windows.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.categorization.embedder import SentenceTransformerEmbedder  # noqa: E402
from app.config import settings  # noqa: E402
from app.scheme_guidance.content import SCHEME_CHUNKS  # noqa: E402
from app.scheme_guidance.repository import replace_all_chunks  # noqa: E402


async def main() -> None:
    print(f"Embedding {len(SCHEME_CHUNKS)} scheme chunks with {settings.embedding_model_name}...")
    embedder = SentenceTransformerEmbedder(settings.embedding_model_name)
    embeddings = embedder.encode_batch([chunk.content for chunk in SCHEME_CHUNKS])

    rows = [
        (chunk.scheme_name, chunk.content, chunk.source_url, chunk.source_title, embedding)
        for chunk, embedding in zip(SCHEME_CHUNKS, embeddings)
    ]

    count = await replace_all_chunks(rows)
    print(f"Loaded {count} scheme chunks into scheme_chunks.")


if __name__ == "__main__":
    asyncio.run(main())
