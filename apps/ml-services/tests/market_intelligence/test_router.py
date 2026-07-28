from unittest.mock import AsyncMock, patch

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestTrainModels:
    def test_delegates_to_the_training_pipeline_and_returns_its_result(self):
        fake_result = {"demand_models_trained": 3, "price_model_trained": False}
        with patch(
            "app.market_intelligence.router.run_training_pipeline",
            new=AsyncMock(return_value=fake_result),
        ) as mock_run:
            response = client.post("/market-intelligence/train-models")

        assert response.status_code == 200
        assert response.json() == fake_result
        mock_run.assert_awaited_once()


class TestGetPrices:
    FAKE_HISTORY = pd.DataFrame(
        [
            {
                "state": "Andhra Pradesh",
                "district": "Anantapur",
                "market": "Anantapur",
                "commodity": "Tomato",
                "variety": "Hybrid",
                "arrival_date": "10/01/2026",
                "min_price": 800.0,
                "max_price": 1200.0,
                "modal_price": 1000.0,
            },
            {
                "state": "Andhra Pradesh",
                "district": "Krishna",
                "market": "Vijayawada",
                "commodity": "Onion",
                "variety": "Local",
                "arrival_date": "09/07/2026",
                "min_price": 1500.0,
                "max_price": 1800.0,
                "modal_price": 1650.0,
            },
        ]
    )

    def test_returns_records_sorted_by_real_date_not_string_order(self):
        # Sorted as text, "09/07/2026" comes before "10/01/2026" — the real
        # calendar order is the opposite (Jan 2026 before Jul 2026).
        with patch(
            "app.market_intelligence.router.load_price_history",
            return_value=self.FAKE_HISTORY,
        ):
            response = client.get("/market-intelligence/prices")

        assert response.status_code == 200
        prices = response.json()["prices"]
        assert [p["commodity"] for p in prices] == ["Onion", "Tomato"]

    def test_filters_by_district_and_commodity_case_insensitively(self):
        with patch(
            "app.market_intelligence.router.load_price_history",
            return_value=self.FAKE_HISTORY,
        ):
            response = client.get(
                "/market-intelligence/prices", params={"district": "anantapur"}
            )

        prices = response.json()["prices"]
        assert len(prices) == 1
        assert prices[0]["district"] == "Anantapur"

    def test_returns_empty_list_when_no_history_exists_yet(self):
        empty_columns = [
            "state",
            "district",
            "market",
            "commodity",
            "variety",
            "arrival_date",
            "min_price",
            "max_price",
            "modal_price",
        ]
        with patch(
            "app.market_intelligence.router.load_price_history",
            return_value=pd.DataFrame(columns=empty_columns),
        ):
            response = client.get("/market-intelligence/prices")

        assert response.status_code == 200
        assert response.json() == {"prices": []}
