from fastapi import APIRouter, HTTPException

from app.market_intelligence import feature_store
from app.market_intelligence.pipeline import run_feature_pipeline

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
