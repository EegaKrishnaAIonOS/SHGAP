from unittest.mock import AsyncMock, patch

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
