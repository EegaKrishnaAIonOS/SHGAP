import logging

import numpy as np
import pandas as pd
import xgboost as xgb

from app.config import settings
from app.market_intelligence import model_registry
from app.market_intelligence.backtest import compute_metrics, time_based_split
from app.market_intelligence.feature_engineering import add_lag_features, add_seasonality_features

logger = logging.getLogger(__name__)

MODEL_TYPE = "price"
REGISTRY_KEY = "pooled"
GROUP_COLS = ["market", "commodity", "variety"]
LAG_COLS = [
    "modal_price_lag_1",
    "modal_price_lag_7",
    "modal_price_lag_28",
    "modal_price_rolling_mean_7",
    "modal_price_rolling_mean_28",
]
FEATURE_COLS = [
    "day_of_week_sin",
    "day_of_week_cos",
    "month_sin",
    "month_cos",
    "is_weekend",
    *LAG_COLS,
    "commodity",
    "market",
]


def _prepare_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["commodity"] = df["commodity"].astype("category")
    df["market"] = df["market"].astype("category")
    return df


def train(price_features: pd.DataFrame) -> dict | None:
    """Trains a *single, pooled* XGBoost regressor across every commodity
    and market seen so far, rather than one model per commodity — Agmarknet
    only ever gives one snapshot per day (ADR-0023), so any one commodity
    has far too little real history to fit its own model for a long time.
    Pooling lets the model learn general day-of-week/seasonal pricing
    patterns from every row together while still distinguishing individual
    commodities/markets via their own categorical features. See ADR-0024.

    Returns `None` (and trains nothing) below `settings.min_price_training_rows`
    total accumulated rows — with too little data a "trained" model would
    just be memorizing noise, and the API should say so plainly rather than
    serve a number that looks precise but isn't.
    """
    model_registry.clear_manifest_entries(MODEL_TYPE)
    if len(price_features) < settings.min_price_training_rows:
        logger.info(
            f"Skipping price model: {len(price_features)} accumulated rows "
            f"(need {settings.min_price_training_rows}) — see ADR-0023/ADR-0024 "
            "on why Agmarknet history starts shallow."
        )
        return None

    df = _prepare_categoricals(price_features)
    train_df, test_df = time_based_split(df, date_col="price_date", min_test_rows=5)
    if len(train_df) < 5 or len(test_df) < 5:
        logger.info("Skipping price model: not enough rows to backtest")
        return None

    model = xgb.XGBRegressor(
        n_estimators=200, max_depth=4, enable_categorical=True, tree_method="hist"
    )
    model.fit(train_df[FEATURE_COLS], train_df["modal_price"])

    predicted = model.predict(test_df[FEATURE_COLS])
    metrics = compute_metrics(test_df["modal_price"], pd.Series(predicted))

    # Refit on the full accumulated history for the model actually served.
    final_model = xgb.XGBRegressor(
        n_estimators=200, max_depth=4, enable_categorical=True, tree_method="hist"
    )
    final_model.fit(df[FEATURE_COLS], df["modal_price"])
    final_model.save_model(model_registry.model_path(f"price_{REGISTRY_KEY}", "json"))

    return model_registry.write_manifest_entry(
        MODEL_TYPE,
        REGISTRY_KEY,
        {
            "training_rows": len(price_features),
            "commodities": sorted(price_features["commodity"].unique().tolist()),
            "date_range": [str(df["price_date"].min()), str(df["price_date"].max())],
            "backtest_mae": metrics.mae,
            "backtest_rmse": metrics.rmse,
            "backtest_mape": metrics.mape,
            "backtest_test_rows": metrics.test_rows,
        },
    )


def forecast(
    commodity: str, market: str, horizon_days: int, price_history: pd.DataFrame
) -> dict | None:
    """Forecasts `horizon_days` ahead for one (commodity, market) pair.
    Recursive, not direct: each predicted day is fed back in as if it were
    a real observation so the next day's lag/rolling features have
    something to compute from — a single XGBoost regressor predicts one day
    at a time, not a whole horizon in one shot, so multi-day forecasts have
    to be built up this way. Returns `None` if no pooled model is
    registered yet, or if this exact (commodity, market) pair has no
    accumulated history to seed the recursion from.
    """
    entry = model_registry.read_manifest_entry(MODEL_TYPE, REGISTRY_KEY)
    if entry is None:
        return None

    series = price_history[
        (price_history["commodity"] == commodity) & (price_history["market"] == market)
    ].copy()
    if series.empty:
        return None

    model = xgb.XGBRegressor()
    model.load_model(model_registry.model_path(f"price_{REGISTRY_KEY}", "json"))

    series["price_date"] = pd.to_datetime(series["arrival_date"], format="%d/%m/%Y")
    series = series.sort_values("price_date")
    last_date = series["price_date"].max()

    predictions = []
    working = series[["price_date", "modal_price"]].rename(columns={"modal_price": "modal_price"})
    for step in range(1, horizon_days + 1):
        next_date = last_date + pd.Timedelta(days=step)
        working_with_next = pd.concat(
            [working, pd.DataFrame({"price_date": [next_date], "modal_price": [np.nan]})],
            ignore_index=True,
        )
        featured = add_seasonality_features(working_with_next, date_col="price_date")
        featured = add_lag_features(
            featured,
            group_cols=[],
            date_col="price_date",
            value_col="modal_price",
            lags=(1, 7, 28),
            rolling_windows=(7, 28),
        )
        row = featured.iloc[[-1]].copy()
        # Plain scalar assignment (not a Series with a mismatched index,
        # which would silently broadcast as NaN here since `row`'s index
        # is whatever `featured` happened to have, not [0]).
        row["commodity"] = commodity
        row["market"] = market
        row["commodity"] = row["commodity"].astype("category")
        row["market"] = row["market"].astype("category")

        predicted_price = float(model.predict(row[FEATURE_COLS])[0])
        predictions.append(
            {"date": next_date.strftime("%Y-%m-%d"), "predicted_price": round(predicted_price, 2)}
        )

        working = pd.concat(
            [working, pd.DataFrame({"price_date": [next_date], "modal_price": [predicted_price]})],
            ignore_index=True,
        )

    return {
        "commodity": commodity,
        "market": market,
        "trained_at": entry["trained_at"],
        "backtest": {
            "mae": entry["backtest_mae"],
            "rmse": entry["backtest_rmse"],
            "mape": entry["backtest_mape"],
        },
        "forecast": predictions,
    }
