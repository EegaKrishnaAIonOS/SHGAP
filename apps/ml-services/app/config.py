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

    # T14 market-intelligence feature pipeline. The resource id/key default to
    # data.gov.in's own public demo credentials for the real "Current Daily
    # Price of Various Commodities from Various Markets (Mandi)" dataset
    # (verified working directly against the live API — see ADR-0023) —
    # shared, rate-limited, and fine for a POC; a real deployment should
    # register its own free key at https://data.gov.in/user/register.
    agmarknet_resource_id: str = os.environ.get(
        "AGMARKNET_RESOURCE_ID", "9ef84268-d588-465a-a308-a864a43d0070"
    )
    agmarknet_api_key: str = os.environ.get(
        "AGMARKNET_API_KEY", "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
    )
    agmarknet_state: str = os.environ.get("AGMARKNET_STATE", "Andhra Pradesh")
    feature_store_dir: str = os.environ.get(
        "FEATURE_STORE_DIR", os.path.join(os.path.dirname(__file__), "..", "data", "features")
    )
    price_history_dir: str = os.environ.get(
        "PRICE_HISTORY_DIR", os.path.join(os.path.dirname(__file__), "..", "data", "price_history")
    )
    feature_pipeline_interval_hours: int = int(
        os.environ.get("FEATURE_PIPELINE_INTERVAL_HOURS", "24")
    )


settings = Settings()
