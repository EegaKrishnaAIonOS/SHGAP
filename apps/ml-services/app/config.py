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

    # Google Trends demand-interest signal. `pytrends` (unofficial, scrapes
    # the public Trends UI — Google has no official public API for this)
    # returns weekly-resolution interest for windows longer than ~90 days, so
    # "5 years" comes back as ~260 weekly points, not 1826 daily ones. `geo`
    # is left at India-wide rather than an AP-only code: pytrends'
    # `interest_over_time` only supports country/state-level `geo` codes for
    # a handful of countries' first-level regions, and this project's own
    # verification found no working Andhra Pradesh sub-region code, so a
    # narrower geo would silently fall back to global data rather than
    # actually being AP-scoped.
    google_trends_keyword: str = os.environ.get("GOOGLE_TRENDS_KEYWORD", "SHG products India")
    google_trends_years: int = int(os.environ.get("GOOGLE_TRENDS_YEARS", "5"))
    google_trends_geo: str = os.environ.get("GOOGLE_TRENDS_GEO", "IN")
    trends_history_dir: str = os.environ.get(
        "TRENDS_HISTORY_DIR",
        os.path.join(os.path.dirname(__file__), "..", "data", "trends_history"),
    )

    # T15 forecasting models
    model_registry_dir: str = os.environ.get(
        "MODEL_REGISTRY_DIR", os.path.join(os.path.dirname(__file__), "..", "data", "models")
    )
    # Retraining runs far less often than the feature refresh above — a
    # model doesn't meaningfully change day to day the way raw features do,
    # and Prophet/XGBoost training is the more expensive of the two jobs.
    training_pipeline_interval_hours: int = int(
        os.environ.get("TRAINING_PIPELINE_INTERVAL_HOURS", "168")  # 7 days
    )
    # Below this many real observation-days, a per-product demand model
    # isn't trained at all — Prophet can technically fit on fewer, but the
    # backtest/forecast would be fitting noise, not a signal. See ADR-0024.
    min_demand_training_days: int = int(os.environ.get("MIN_DEMAND_TRAINING_DAYS", "30"))
    # Below this many observed calendar days (default 2 years), a product's
    # demand model is fit with yearly_seasonality=False — one pass through
    # the calendar isn't enough to distinguish a real annual cycle from
    # noise. ADR-0024 originally hardcoded this off entirely, since the
    # seeded demo history never had close to a year of data; real multi-year
    # history should get to use it once there's actually enough of it.
    demand_yearly_seasonality_min_days: int = int(
        os.environ.get("DEMAND_YEARLY_SEASONALITY_MIN_DAYS", str(365 * 2))
    )
    # Below this many total accumulated price rows (pooled across every
    # commodity/market), the price model isn't trained at all. Agmarknet's
    # snapshot-only API means this starts at 0 and grows slowly — see
    # ADR-0023/ADR-0024.
    min_price_training_rows: int = int(os.environ.get("MIN_PRICE_TRAINING_ROWS", "30"))

    # T17 buyer matching / recommendations
    # Below this many real accept/reject responses (across every
    # recommendation ever served), the LightGBM re-ranker isn't trained —
    # a ranker fit on a handful of labels would be memorizing noise, not
    # learning a real preference signal. Until then, recommendations are
    # ranked by the heuristic weighted score directly. See ADR-0026.
    min_feedback_rows_for_ranker: int = int(
        os.environ.get("MIN_FEEDBACK_ROWS_FOR_RANKER", "30")
    )
    # How many days ahead of demand to sum into a recommendation's
    # `expectedDemand` figure (reuses T15's trained per-product Prophet
    # model — see matching/demand_estimate.py).
    expected_demand_horizon_days: int = int(
        os.environ.get("EXPECTED_DEMAND_HORIZON_DAYS", "30")
    )


settings = Settings()
