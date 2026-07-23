from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class BacktestMetrics:
    mae: float
    rmse: float
    # MAPE is undefined (division by zero) wherever the actual value is 0 —
    # those rows are excluded from the MAPE average specifically (not from
    # MAE/RMSE, which handle zero actuals fine). `None` when every actual in
    # the test window was 0, rather than a misleading 0.0 or NaN.
    mape: float | None
    test_rows: int


def compute_metrics(actual: pd.Series, predicted: pd.Series) -> BacktestMetrics:
    actual = actual.to_numpy(dtype=float)
    predicted = predicted.to_numpy(dtype=float)

    errors = predicted - actual
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors**2)))

    nonzero = actual != 0
    mape = (
        float(np.mean(np.abs(errors[nonzero] / actual[nonzero])) * 100) if nonzero.any() else None
    )

    return BacktestMetrics(mae=mae, rmse=rmse, mape=mape, test_rows=len(actual))


def time_based_split(
    df: pd.DataFrame, date_col: str, test_fraction: float = 0.2, min_test_rows: int = 7
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Splits a time-ordered dataframe into (train, test) by date, not a
    random shuffle — a forecasting backtest must only ever test on dates
    after everything the model trained on, or the reported accuracy would
    be measuring the model's ability to interpolate the past, not forecast
    the future. `min_test_rows` guarantees the test set is large enough for
    the metrics above to mean something, even for a group whose most recent
    `test_fraction` share is smaller than that in row count."""
    ordered = df.sort_values(date_col).reset_index(drop=True)
    test_rows = max(min_test_rows, round(len(ordered) * test_fraction))
    split_at = max(0, len(ordered) - test_rows)
    return ordered.iloc[:split_at], ordered.iloc[split_at:]
