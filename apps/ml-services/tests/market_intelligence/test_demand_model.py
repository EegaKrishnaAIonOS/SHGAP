import pandas as pd

from app.config import settings
from app.market_intelligence import demand_model


def _sales_df(num_days: int, product_id: str = "p1", district_id: str = "d1") -> pd.DataFrame:
    dates = pd.date_range("2026-01-01", periods=num_days, freq="D")
    return pd.DataFrame(
        {
            "sale_date": dates.strftime("%Y-%m-%d"),
            "product_id": product_id,
            "district_id": district_id,
            # A mild weekly pattern so Prophet has an actual signal to fit,
            # not pure noise.
            "total_quantity": [5.0 + (2.0 if d.dayofweek in (5, 6) else 0.0) for d in dates],
        }
    )


class TestDensifyDailySeries:
    def test_fills_missing_calendar_days_with_zero(self):
        # Only day 1 and day 3 have real rows -> day 2 is a real gap.
        df = pd.DataFrame(
            {"sale_date": ["2026-01-01", "2026-01-03"], "total_quantity": [10.0, 30.0]}
        )
        dense = demand_model._densify_daily_series(df, district_id="d1")
        assert len(dense) == 3
        gap_day = dense.loc[dense["sale_date"] == pd.Timestamp("2026-01-02"), "total_quantity"]
        assert gap_day.iloc[0] == 0.0
        assert (dense["district_id"] == "d1").all()


class TestTrainOneProduct:
    def test_returns_none_below_the_minimum_observed_days_threshold(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_demand_training_days", 30)
        result = demand_model.train_one_product("p1", "d1", _sales_df(10), festivals=[])
        assert result is None

    def test_trains_backtests_and_registers_with_enough_history(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_demand_training_days", 30)
        result = demand_model.train_one_product("p1", "d1", _sales_df(45), festivals=[])

        assert result is not None
        assert result["district_id"] == "d1"
        assert result["observed_days"] == 45
        assert result["backtest_mae"] >= 0
        assert result["backtest_rmse"] >= 0
        assert result["backtest_test_rows"] > 0
        # A model file was actually serialized, not just a manifest entry.
        assert (tmp_path / "demand_p1.json").exists()


class TestTrainAll:
    def test_skips_products_below_threshold_and_registers_the_rest(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_demand_training_days", 30)
        sales_features = pd.concat(
            [_sales_df(45, product_id="p1"), _sales_df(10, product_id="p2")], ignore_index=True
        )

        results = demand_model.train_all(sales_features, festivals=[])

        assert "p1" in results
        assert "p2" not in results

    def test_empty_sales_features_yields_no_results(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        assert demand_model.train_all(pd.DataFrame(), festivals=[]) == {}


class TestForecast:
    def test_returns_none_when_no_model_is_registered(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        assert demand_model.forecast("does-not-exist", 7, festivals=[]) is None

    def test_forecast_continues_after_the_training_data_ends(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_demand_training_days", 30)
        demand_model.train_one_product("p1", "d1", _sales_df(45), festivals=[])

        result = demand_model.forecast("p1", 7, festivals=[])

        assert result is not None
        assert result["product_id"] == "p1"
        assert len(result["forecast"]) == 7
        last_training_date = pd.Timestamp("2026-01-01") + pd.Timedelta(days=44)
        forecast_dates = [pd.Timestamp(row["date"]) for row in result["forecast"]]
        assert all(d > last_training_date for d in forecast_dates)
        assert all(row["predicted_quantity"] >= 0 for row in result["forecast"])
