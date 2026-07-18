import os

from dotenv import load_dotenv

# Loads apps/ml-services/.env (if present) into the process environment before
# Settings reads it — mirrors core-api's ConfigModule and Prisma, which both
# auto-load .env, so local dev doesn't need a manual `export`. A no-op when
# the file doesn't exist (e.g. in CI/Docker, where real env vars are injected).
load_dotenv()


class Settings:
    """Plain env-var config — no pydantic-settings dependency needed for
    this small a surface. `DATABASE_URL` uses libpq's own DSN format (no
    Prisma-style `?schema=` suffix, unlike core-api's).

    Read with `.get(..., "")` rather than indexing, so importing this module
    (e.g. during test collection, before a real environment is configured)
    never raises — connecting with an empty DSN fails clearly at the point
    of use instead.
    """

    database_url: str = os.environ.get("DATABASE_URL", "")
    embedding_model_name: str = os.environ.get(
        "EMBEDDING_MODEL_NAME", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    category_cache_ttl_seconds: int = int(os.environ.get("CATEGORY_CACHE_TTL_SECONDS", "300"))


settings = Settings()
