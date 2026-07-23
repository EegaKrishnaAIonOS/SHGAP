import numpy as np
import pandas as pd

from app.config import settings
from app.market_intelligence import price_model
from app.market_intelligence.feature_engineering import add_lag_features, add_seasonality_features


def _raw_price_history(num_days: int = 90) -> pd.DataFrame:
    """Mirrors Agmarknet's real schema (state/district/market/commodity/
    variety/arrival_date DD/MM/YYYY/min/max/modal), the shape
    price_history_store.load_price_history() actually returns."""
    dates = pd.date_range("2026-01-01", periods=num_days, freq="D")
    rng = np.random.default_rng(42)
    rows = []
    for commodity, market, base in [("Tomato", "Guntur", 25.0), ("Onion", "Kurnool", 18.0)]:
        for d in dates:
            price = base + 3 * np.sin(d.dayofyear / 7) + rng.normal(0, 1.5)
            rows.append(
                {
                    "state": "Andhra Pradesh",
                    "district": "X",
                    "market": market,
                    "commodity": commodity,
                    "variety": "Local",
                    "arrival_date": d.strftime("%d/%m/%Y"),
                    "min_price": price - 1,
                    "max_price": price + 1,
                    "modal_price": price,
                }
            )
    return pd.DataFrame(rows)


def _price_features(raw: pd.DataFrame) -> pd.DataFrame:
    """Mirrors pipeline.py's _build_price_features exactly (seasonality +
    lag/rolling features, no dropna) — this is the real shape
    price_model.train() receives in production."""
    df = raw.copy()
    df["price_date"] = pd.to_datetime(df["arrival_date"], format="%d/%m/%Y")
    df = add_seasonality_features(df, date_col="price_date")
    df = add_lag_features(
        df,
        group_cols=["market", "commodity", "variety"],
        date_col="price_date",
        value_col="modal_price",
    )
    return df


class TestTrain:
    def test_returns_none_below_minimum_training_rows(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_price_training_rows", 30)
        tiny = _price_features(_raw_price_history(num_days=5))
        assert price_model.train(tiny) is None

    def test_trains_backtests_and_registers_the_pooled_model(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_price_training_rows", 30)
        features = _price_features(_raw_price_history())

        result = price_model.train(features)

        assert result is not None
        assert set(result["commodities"]) == {"Onion", "Tomato"}
        assert result["backtest_mae"] >= 0
        assert result["backtest_test_rows"] > 0
        assert (tmp_path / "price_pooled.json").exists()

    def test_real_agmarknet_lag_nans_do_not_crash_training(self, monkeypatch, tmp_path):
        """price_features from pipeline.py never drops NaN lag rows (the
        first `lag` rows per commodity/market have no history yet) — this
        proves XGBoost's native missing-value handling copes with that
        rather than requiring a manual dropna."""
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_price_training_rows", 30)
        features = _price_features(_raw_price_history())
        assert features[price_model.LAG_COLS].isna().any().any()  # confirms real NaNs are present

        result = price_model.train(features)
        assert result is not None


class TestForecast:
    def test_returns_none_when_no_model_is_registered(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        raw = _raw_price_history()
        assert price_model.forecast("Tomato", "Guntur", 7, raw) is None

    def test_returns_none_for_a_commodity_market_pair_with_no_history(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_price_training_rows", 30)
        raw = _raw_price_history()
        price_model.train(_price_features(raw))

        assert price_model.forecast("Potato", "Nowhere", 7, raw) is None

    def test_recursive_forecast_produces_sequential_future_dates(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_price_training_rows", 30)
        raw = _raw_price_history()
        price_model.train(_price_features(raw))

        result = price_model.forecast("Tomato", "Guntur", 5, raw)

        assert result is not None
        assert result["commodity"] == "Tomato"
        assert result["market"] == "Guntur"
        assert len(result["forecast"]) == 5

        dates = [pd.Timestamp(row["date"]) for row in result["forecast"]]
        assert dates == sorted(dates)
        assert len(set(dates)) == 5  # no duplicate/repeated day
        last_real_date = pd.to_datetime(raw["arrival_date"], format="%d/%m/%Y").max()
        assert all(d > last_real_date for d in dates)
        for row in result["forecast"]:
            assert isinstance(row["predicted_price"], float)
