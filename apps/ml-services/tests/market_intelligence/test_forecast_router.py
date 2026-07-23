from unittest.mock import AsyncMock, patch

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestForecastDemand:
    def test_returns_the_forecast_payload_on_success(self):
        fake_result = {
            "product_id": "p1",
            "forecast": [{"date": "2026-08-01", "predicted_quantity": 3.0}],
        }
        with (
            patch(
                "app.market_intelligence.forecast_router.fetch_festivals",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "app.market_intelligence.forecast_router.demand_model.forecast",
                return_value=fake_result,
            ) as mock_forecast,
        ):
            response = client.get(
                "/forecast/demand", params={"product_id": "p1", "horizon_days": 5}
            )

        assert response.status_code == 200
        assert response.json() == fake_result
        mock_forecast.assert_called_once_with("p1", 5, [])

    def test_returns_404_when_no_model_is_registered(self):
        with (
            patch(
                "app.market_intelligence.forecast_router.fetch_festivals",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "app.market_intelligence.forecast_router.demand_model.forecast", return_value=None
            ),
        ):
            response = client.get("/forecast/demand", params={"product_id": "does-not-exist"})

        assert response.status_code == 404

    def test_horizon_days_out_of_range_is_rejected(self):
        response = client.get("/forecast/demand", params={"product_id": "p1", "horizon_days": 999})
        assert response.status_code == 422


class TestForecastPrice:
    def test_returns_the_forecast_payload_on_success(self):
        fake_result = {"commodity": "Tomato", "market": "Guntur", "forecast": []}
        with (
            patch(
                "app.market_intelligence.forecast_router.load_price_history",
                return_value=pd.DataFrame(),
            ),
            patch(
                "app.market_intelligence.forecast_router.price_model.forecast",
                return_value=fake_result,
            ) as mock_forecast,
        ):
            response = client.get(
                "/forecast/price",
                params={"commodity": "Tomato", "market": "Guntur", "horizon_days": 7},
            )

        assert response.status_code == 200
        assert response.json() == fake_result
        args, _ = mock_forecast.call_args
        assert args[0] == "Tomato"
        assert args[1] == "Guntur"
        assert args[2] == 7

    def test_returns_404_when_no_pooled_model_is_registered(self):
        with (
            patch(
                "app.market_intelligence.forecast_router.load_price_history",
                return_value=pd.DataFrame(),
            ),
            patch(
                "app.market_intelligence.forecast_router.price_model.forecast", return_value=None
            ),
        ):
            response = client.get(
                "/forecast/price", params={"commodity": "Tomato", "market": "Guntur"}
            )

        assert response.status_code == 404


class TestHotspots:
    def test_returns_hotspots_computed_from_the_current_feature_store(self):
        fake_hotspots = [{"h3_cell": "abc", "total_amount": 100.0}]
        with (
            patch(
                "app.market_intelligence.forecast_router.feature_store.read_features",
                return_value=(pd.DataFrame({"h3_cell": ["abc"]}), pd.DataFrame()),
            ),
            patch(
                "app.market_intelligence.forecast_router.hotspots.compute_hotspots",
                return_value=fake_hotspots,
            ) as mock_compute,
        ):
            response = client.get("/hotspots", params={"top_n": 5})

        assert response.status_code == 200
        assert response.json() == {"hotspots": fake_hotspots}
        args, _ = mock_compute.call_args
        assert args[1] == 5


class TestSeasonality:
    def test_returns_seasonality_computed_from_the_current_feature_store(self):
        fake_result = {"product_id": "p1", "by_day_of_week": [], "by_month": []}
        with (
            patch(
                "app.market_intelligence.forecast_router.feature_store.read_features",
                return_value=(pd.DataFrame(), pd.DataFrame()),
            ),
            patch(
                "app.market_intelligence.forecast_router.seasonality.compute_seasonality",
                return_value=fake_result,
            ) as mock_compute,
        ):
            response = client.get("/seasonality", params={"product_id": "p1"})

        assert response.status_code == 200
        assert response.json() == fake_result
        args, _ = mock_compute.call_args
        assert args[1] == "p1"
