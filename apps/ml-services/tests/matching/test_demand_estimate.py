from unittest.mock import patch

from app.matching.demand_estimate import estimate_expected_demand


class TestEstimateExpectedDemand:
    def test_returns_none_when_no_model_is_registered(self):
        with patch(
            "app.matching.demand_estimate.demand_model.forecast", return_value=None
        ) as mock_forecast:
            result = estimate_expected_demand("prod-1", festivals=[])

        assert result is None
        mock_forecast.assert_called_once()

    def test_sums_predicted_quantity_over_the_horizon(self):
        fake_forecast = {
            "forecast": [
                {"date": "2026-08-01", "predicted_quantity": 10.5},
                {"date": "2026-08-02", "predicted_quantity": 12.25},
                {"date": "2026-08-03", "predicted_quantity": 8.0},
            ]
        }
        with patch(
            "app.matching.demand_estimate.demand_model.forecast", return_value=fake_forecast
        ):
            result = estimate_expected_demand("prod-1", festivals=[])

        assert result == 30.75
