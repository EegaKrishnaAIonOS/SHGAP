import logging

import pandas as pd
from prophet import Prophet
from prophet.serialize import model_from_json, model_to_json

from app.config import settings
from app.market_intelligence import model_registry
from app.market_intelligence.backtest import compute_metrics, time_based_split
from app.market_intelligence.feature_engineering import add_festival_features
from app.market_intelligence.repository import FestivalRecord

logging.getLogger("cmdstanpy").setLevel(logging.WARNING)  # Prophet's fit-progress spam otherwise
logger = logging.getLogger(__name__)

MODEL_TYPE = "demand"
REGRESSORS = ["is_weekend_num", "is_festival_window_num"]


def _densify_daily_series(product_df: pd.DataFrame, district_id: str) -> pd.DataFrame:
    """Real sales rows only exist for days something actually sold — but a
    day with no recorded sale is a real zero-demand observation, not a
    missing one. Reindexing to every calendar day in the product's own
    observed range and filling the gaps with 0 is what lets Prophet learn
    "this mostly doesn't sell on Tuesdays" rather than never seeing Tuesday
    at all. `day_of_week`/`is_weekend`/festival features are recomputed
    fresh for the filled-in dates rather than carried over, since those
    rows never went through T14's own feature pipeline."""
    dates = pd.to_datetime(product_df["sale_date"])
    full_range = pd.date_range(dates.min(), dates.max(), freq="D")

    dense = pd.DataFrame({"sale_date": full_range})
    dense = dense.merge(
        product_df[["sale_date", "total_quantity"]].assign(
            sale_date=pd.to_datetime(product_df["sale_date"])
        ),
        on="sale_date",
        how="left",
    )
    dense["total_quantity"] = dense["total_quantity"].fillna(0.0)
    dense["district_id"] = district_id
    return dense


def _prepare_prophet_frame(dense_df: pd.DataFrame, festivals: list[FestivalRecord]) -> pd.DataFrame:
    df = add_festival_features(
        dense_df, date_col="sale_date", district_col="district_id", festivals=festivals
    )
    df["is_weekend_num"] = pd.to_datetime(df["sale_date"]).dt.dayofweek.isin([5, 6]).astype(int)
    df["is_festival_window_num"] = df["is_festival_window"].astype(int)
    return df.rename(columns={"sale_date": "ds", "total_quantity": "y"})[["ds", "y", *REGRESSORS]]


def _fit_prophet(train_df: pd.DataFrame) -> Prophet:
    # yearly_seasonality is deliberately off: fitting a yearly cycle from
    # well under a year of real history would just be fitting noise, not a
    # real seasonal signal — see ADR-0024.
    model = Prophet(yearly_seasonality=False, weekly_seasonality=True)
    for regressor in REGRESSORS:
        model.add_regressor(regressor)
    model.fit(train_df)
    return model


def train_one_product(
    product_id: str, district_id: str, product_df: pd.DataFrame, festivals: list[FestivalRecord]
) -> dict | None:
    """Trains, backtests and registers a demand model for one product.
    Returns the manifest entry written, or `None` if this product doesn't
    have enough real observation history yet (see
    `settings.min_demand_training_days`)."""
    if product_df["sale_date"].nunique() < settings.min_demand_training_days:
        logger.info(
            f"Skipping demand model for product {product_id}: "
            f"only {product_df['sale_date'].nunique()} observed days "
            f"(need {settings.min_demand_training_days})"
        )
        return None

    dense = _densify_daily_series(product_df, district_id)
    prophet_df = _prepare_prophet_frame(dense, festivals)

    train_df, test_df = time_based_split(prophet_df, date_col="ds")
    if len(test_df) < 7 or len(train_df) < 7:
        logger.info(f"Skipping demand model for product {product_id}: not enough rows to backtest")
        return None

    model = _fit_prophet(train_df)
    forecast = model.predict(test_df[["ds", *REGRESSORS]])
    predicted = forecast["yhat"].clip(lower=0)
    metrics = compute_metrics(test_df["y"], predicted)

    # Refit on the *full* series (train + test) for the model actually
    # served — the held-out split above exists only to measure honest
    # accuracy, not to withhold real data from the production model.
    final_model = _fit_prophet(prophet_df)

    with open(model_registry.model_path(f"demand_{product_id}", "json"), "w") as f:
        f.write(model_to_json(final_model))

    return model_registry.write_manifest_entry(
        MODEL_TYPE,
        product_id,
        {
            "district_id": district_id,
            "observed_days": int(product_df["sale_date"].nunique()),
            "date_range": [str(dense["sale_date"].min()), str(dense["sale_date"].max())],
            "backtest_mae": metrics.mae,
            "backtest_rmse": metrics.rmse,
            "backtest_mape": metrics.mape,
            "backtest_test_rows": metrics.test_rows,
        },
    )


def train_all(sales_features: pd.DataFrame, festivals: list[FestivalRecord]) -> dict[str, dict]:
    model_registry.clear_manifest_entries(MODEL_TYPE)
    results: dict[str, dict] = {}
    if sales_features.empty:
        return results

    for product_id, group in sales_features.groupby("product_id"):
        district_id = group["district_id"].iloc[0]
        entry = train_one_product(product_id, district_id, group, festivals)
        if entry:
            results[product_id] = entry
    return results


def forecast(product_id: str, horizon_days: int, festivals: list[FestivalRecord]) -> dict | None:
    """Forecasts `horizon_days` ahead for `product_id` using its registered
    model. Returns `None` if no model has been trained for this product yet
    (the caller should respond with a clear "train first" message, not a
    500)."""
    entry = model_registry.read_manifest_entry(MODEL_TYPE, product_id)
    if entry is None:
        return None

    with open(model_registry.model_path(f"demand_{product_id}", "json")) as f:
        model = model_from_json(f.read())

    future = model.make_future_dataframe(periods=horizon_days)
    future = future[future["ds"] > pd.to_datetime(entry["date_range"][1])]
    # total_quantity is unknown for these not-yet-observed dates — it's a
    # placeholder so _prepare_prophet_frame's rename to "y" has a column to
    # find; the actual values are dropped below (only "ds" + regressors are
    # passed to model.predict()).
    future_dense = pd.DataFrame(
        {"sale_date": future["ds"], "district_id": entry["district_id"], "total_quantity": 0.0}
    )
    future_prepared = _prepare_prophet_frame(future_dense, festivals)

    forecast_df = model.predict(future_prepared[["ds", *REGRESSORS]])
    predicted = forecast_df["yhat"].clip(lower=0)

    return {
        "product_id": product_id,
        "district_id": entry["district_id"],
        "trained_at": entry["trained_at"],
        "backtest": {
            "mae": entry["backtest_mae"],
            "rmse": entry["backtest_rmse"],
            "mape": entry["backtest_mape"],
        },
        "forecast": [
            {"date": ds.strftime("%Y-%m-%d"), "predicted_quantity": round(float(yhat), 2)}
            for ds, yhat in zip(forecast_df["ds"], predicted)
        ],
    }
