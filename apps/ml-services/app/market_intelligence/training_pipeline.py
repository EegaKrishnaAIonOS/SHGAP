from app.market_intelligence import demand_model, feature_store, price_model
from app.market_intelligence.repository import fetch_festivals


async def run_training_pipeline() -> dict:
    """Trains and registers both forecasting models against whatever T14's
    feature pipeline last produced — it does not re-derive features itself,
    so `POST /market-intelligence/refresh-features` should generally run
    (or have run recently) before this. Safe to call with stale or even
    empty feature tables: both model trainers check their own minimum-data
    thresholds and simply register nothing if there isn't enough yet,
    rather than fitting a model to noise (see ADR-0024).
    """
    # trends_features (3rd table) isn't consumed here yet — see
    # feature_engineering.add_trends_features' docstring for why using it as
    # a Prophet regressor is a stated gap, not a silent one.
    sales_features, price_features, _trends_features = feature_store.read_features()
    festivals = await fetch_festivals()

    demand_results = demand_model.train_all(sales_features, festivals)
    price_result = price_model.train(price_features)

    return {
        "demand_models_trained": len(demand_results),
        "demand_products": list(demand_results.keys()),
        "price_model_trained": price_result is not None,
        "price_model": price_result,
    }
