import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.market_intelligence import feature_store
from app.market_intelligence.pipeline import run_feature_pipeline
from app.market_intelligence.price_history_store import load_price_history
from app.market_intelligence.training_pipeline import run_training_pipeline

router = APIRouter(prefix="/market-intelligence", tags=["market-intelligence"])


@router.post("/refresh-features")
async def refresh_features() -> dict:
    """On-demand trigger for the feature pipeline — the same function the
    APScheduler job (see app/main.py) calls automatically every
    `FEATURE_PIPELINE_INTERVAL_HOURS`. Useful for testing and for forcing a
    refresh right after new sales data lands, without waiting for the next
    scheduled run."""
    return await run_feature_pipeline()


@router.get("/feature-status")
def feature_status() -> dict:
    manifest = feature_store.read_manifest()
    if manifest is None:
        raise HTTPException(
            status_code=404,
            detail="No feature pipeline run yet — POST /market-intelligence/refresh-features first",
        )
    return manifest


@router.post("/train-models")
async def train_models() -> dict:
    """On-demand trigger for the T15 training pipeline — the same function
    the weekly APScheduler job (see app/main.py) calls automatically every
    `TRAINING_PIPELINE_INTERVAL_HOURS`. Trains on whatever T14's feature
    pipeline last produced; does not refresh features itself, so
    POST /market-intelligence/refresh-features should generally run first."""
    return await run_training_pipeline()


@router.get("/prices")
def get_prices(
    district: str | None = None,
    commodity: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
) -> dict:
    """Real, ingested Agmarknet price records (T14/ADR-0023) — never
    exposed to a dashboard until T21. Reads the same local price-history
    archive the forecasting pipeline (T15) already reads from; this adds
    no new ingestion, just a read surface over data that already exists."""
    history = load_price_history()
    if district:
        history = history[history["district"].str.casefold() == district.casefold()]
    if commodity:
        history = history[history["commodity"].str.casefold() == commodity.casefold()]
    if not history.empty:
        # `arrival_date` is Agmarknet's own DD/MM/YYYY string (see
        # MandiPriceRecord) — sorting it as text would put "09/07/2026"
        # after "10/01/2026". Parse only for ordering; the returned field
        # stays the original string.
        history = history.assign(
            _parsed_date=pd.to_datetime(history["arrival_date"], format="%d/%m/%Y", errors="coerce")
        )
        history = history.sort_values("_parsed_date", ascending=False).drop(columns="_parsed_date")
    history = history.head(limit)
    return {"prices": history.to_dict(orient="records")}
