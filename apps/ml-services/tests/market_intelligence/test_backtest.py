import pandas as pd
import pytest

from app.market_intelligence.backtest import compute_metrics, time_based_split


class TestComputeMetrics:
    def test_mae_and_rmse_match_hand_computed_values(self):
        actual = pd.Series([10.0, 20.0, 30.0])
        predicted = pd.Series([12.0, 18.0, 33.0])
        # errors: 2, -2, 3 -> abs errors: 2, 2, 3 -> MAE = 7/3
        metrics = compute_metrics(actual, predicted)
        assert metrics.mae == pytest.approx(7 / 3)
        assert metrics.rmse == pytest.approx(((2**2 + 2**2 + 3**2) / 3) ** 0.5)
        assert metrics.test_rows == 3

    def test_mape_excludes_zero_actuals(self):
        actual = pd.Series([0.0, 10.0])
        predicted = pd.Series([5.0, 12.0])
        metrics = compute_metrics(actual, predicted)
        # Only the second row (actual=10) counts: |12-10|/10 * 100 = 20%.
        assert metrics.mape == pytest.approx(20.0)

    def test_mape_is_none_when_every_actual_is_zero(self):
        actual = pd.Series([0.0, 0.0])
        predicted = pd.Series([1.0, 2.0])
        metrics = compute_metrics(actual, predicted)
        assert metrics.mape is None


class TestTimeBasedSplit:
    def test_split_is_time_ordered_not_random(self):
        df = pd.DataFrame(
            {"date": pd.date_range("2026-01-10", periods=10, freq="D"), "value": range(10)}
        )
        # Shuffle input order to prove the split re-sorts by date itself.
        shuffled = df.sample(frac=1, random_state=1)
        train_df, test_df = time_based_split(shuffled, date_col="date", test_fraction=0.3)

        assert train_df["date"].max() < test_df["date"].min()
        assert list(test_df["value"]) == sorted(test_df["value"])

    def test_min_test_rows_is_respected_even_if_fraction_would_give_fewer(self):
        df = pd.DataFrame(
            {"date": pd.date_range("2026-01-01", periods=20, freq="D"), "value": range(20)}
        )
        # 10% of 20 = 2 rows, but min_test_rows=7 should win.
        _, test_df = time_based_split(df, date_col="date", test_fraction=0.1, min_test_rows=7)
        assert len(test_df) == 7

    def test_split_never_produces_overlapping_rows(self):
        df = pd.DataFrame(
            {"date": pd.date_range("2026-01-01", periods=15, freq="D"), "value": range(15)}
        )
        train_df, test_df = time_based_split(df, date_col="date", test_fraction=0.2)
        assert len(train_df) + len(test_df) == len(df)
        assert set(train_df["value"]).isdisjoint(set(test_df["value"]))
