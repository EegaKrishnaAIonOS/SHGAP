from fastapi import APIRouter, HTTPException, Query

from app.market_intelligence import demand_model, feature_store, hotspots, price_model, seasonality
from app.market_intelligence.price_history_store import load_price_history
from app.market_intelligence.repository import fetch_festivals

# Deliberately flat, top-level paths (not nested under /market-intelligence)
# — this matches the exact endpoint names T15's task description asks for.
router = APIRouter(tags=["forecasting"])


@router.get("/forecast/demand")
async def forecast_demand(
    product_id: str, horizon_days: int = Query(default=14, ge=1, le=90)
) -> dict:
    festivals = await fetch_festivals()
    result = demand_model.forecast(product_id, horizon_days, festivals)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No demand model registered for product {product_id} — either it doesn't "
                "have enough observed sales history yet, or POST /market-intelligence/"
                "train-models hasn't run since it started accumulating enough."
            ),
        )
    return result


@router.get("/forecast/price")
def forecast_price(
    commodity: str, market: str, horizon_days: int = Query(default=7, ge=1, le=30)
) -> dict:
    price_history = load_price_history()
    result = price_model.forecast(commodity, market, horizon_days, price_history)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No price forecast available for {commodity} at {market} — either no "
                "pooled price model is registered yet (see ADR-0023/ADR-0024 on why "
                "Agmarknet history starts shallow), or this exact commodity/market pair "
                "has no accumulated history to forecast from."
            ),
        )
    return result


@router.get("/hotspots")
def get_hotspots(top_n: int = Query(default=20, ge=1, le=100)) -> dict:
    sales_features, _ = feature_store.read_features()
    return {"hotspots": hotspots.compute_hotspots(sales_features, top_n)}


@router.get("/seasonality")
def get_seasonality(product_id: str | None = None) -> dict:
    sales_features, _ = feature_store.read_features()
    return seasonality.compute_seasonality(sales_features, product_id)
