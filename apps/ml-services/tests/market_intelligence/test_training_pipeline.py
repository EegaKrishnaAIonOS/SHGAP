from unittest.mock import AsyncMock, patch

import pandas as pd

from app.market_intelligence.training_pipeline import run_training_pipeline


async def test_delegates_to_both_model_trainers_and_summarizes_results():
    sales_features = pd.DataFrame({"product_id": ["p1"]})
    price_features = pd.DataFrame({"commodity": ["Tomato"]})

    with (
        patch(
            "app.market_intelligence.training_pipeline.feature_store.read_features",
            return_value=(sales_features, price_features),
        ),
        patch(
            "app.market_intelligence.training_pipeline.fetch_festivals",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "app.market_intelligence.training_pipeline.demand_model.train_all",
            return_value={"p1": {"backtest_mae": 1.0}},
        ) as mock_train_demand,
        patch(
            "app.market_intelligence.training_pipeline.price_model.train",
            return_value={"backtest_mae": 2.0},
        ) as mock_train_price,
    ):
        result = await run_training_pipeline()

    mock_train_demand.assert_called_once_with(sales_features, [])
    mock_train_price.assert_called_once_with(price_features)
    assert result["demand_models_trained"] == 1
    assert result["demand_products"] == ["p1"]
    assert result["price_model_trained"] is True
    assert result["price_model"] == {"backtest_mae": 2.0}


async def test_reports_honestly_when_neither_model_trains():
    with (
        patch(
            "app.market_intelligence.training_pipeline.feature_store.read_features",
            return_value=(pd.DataFrame(), pd.DataFrame()),
        ),
        patch(
            "app.market_intelligence.training_pipeline.fetch_festivals",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "app.market_intelligence.training_pipeline.demand_model.train_all", return_value={}
        ),
        patch(
            "app.market_intelligence.training_pipeline.price_model.train", return_value=None
        ),
    ):
        result = await run_training_pipeline()

    assert result["demand_models_trained"] == 0
    assert result["price_model_trained"] is False
    assert result["price_model"] is None
