import logging

import pandas as pd

from app.config import settings
from app.market_intelligence import feature_store, price_history_store, trends_history_store
from app.market_intelligence.agmarknet_client import AgmarknetError, fetch_daily_prices
from app.market_intelligence.feature_engineering import (
    add_festival_features,
    add_geo_features,
    add_lag_features,
    add_seasonality_features,
    add_trends_features,
)
from app.market_intelligence.google_trends_client import (
    GoogleTrendsError,
    fetch_interest_over_time,
)
from app.market_intelligence.repository import fetch_festivals, fetch_products, fetch_sales

logger = logging.getLogger(__name__)


def _build_sales_features(sales, festivals) -> pd.DataFrame:
    if not sales:
        return pd.DataFrame()

    df = pd.DataFrame([vars(s) for s in sales])

    # One row per sale transaction isn't the right grain for demand
    # forecasting (T15) — aggregate to one row per (product, day) first, the
    # same "per product x district" grain T15's task description asks for.
    daily = (
        df.groupby(["product_id", "shg_id", "district_id", "category_id", "sale_date"])
        .agg(
            total_quantity=("quantity", "sum"),
            total_amount=("total_amount", "sum"),
            avg_unit_price=("unit_price", "mean"),
            lat=("lat", "first"),
            lng=("lng", "first"),
        )
        .reset_index()
    )

    daily = add_seasonality_features(daily, date_col="sale_date")
    daily = add_festival_features(
        daily, date_col="sale_date", district_col="district_id", festivals=festivals
    )
    daily = add_geo_features(daily, lat_col="lat", lng_col="lng")
    daily = add_lag_features(
        daily,
        group_cols=["product_id"],
        date_col="sale_date",
        value_col="total_quantity",
    )
    return daily


def _build_price_features(price_history: pd.DataFrame) -> pd.DataFrame:
    if price_history.empty:
        return price_history

    df = price_history.copy()
    # Agmarknet dates are DD/MM/YYYY strings, not ISO.
    df["price_date"] = pd.to_datetime(df["arrival_date"], format="%d/%m/%Y")

    df = add_seasonality_features(df, date_col="price_date")
    df = add_lag_features(
        df,
        group_cols=["market", "commodity", "variety"],
        date_col="price_date",
        value_col="modal_price",
    )
    return df


def _build_trends_features(trends_history: pd.DataFrame) -> pd.DataFrame:
    if trends_history.empty:
        return trends_history

    return add_trends_features(trends_history.copy(), date_col="date", value_col="interest")


async def run_feature_pipeline() -> dict:
    """The T14 pipeline: ingest sales/products/festivals from Postgres,
    today's mandi prices from Agmarknet, and a 5-year Google Trends search-
    interest window for `settings.google_trends_keyword`; engineer features
    (seasonality, festival proximity, H3 geo, lag/rolling) for each; and
    write all three feature tables to Parquet. Returns the manifest
    `feature_store.write_features` produces.

    Fetching products isn't used for feature engineering directly today (no
    feature currently needs product metadata beyond what's already in
    `sales`) — it's still ingested and returned in the summary so a caller
    can confirm the product catalogue this pipeline ran against, and so
    T15's forecasting models have it available without a second round trip.
    """
    sales = await fetch_sales()
    festivals = await fetch_festivals()
    products = await fetch_products()

    try:
        today_prices = fetch_daily_prices(settings.agmarknet_state)
        price_history = price_history_store.append_daily_snapshot(today_prices)
    except AgmarknetError as err:
        # A failed external API call shouldn't block sales features (which
        # don't depend on it) — fall back to whatever history already
        # accumulated from previous successful runs, and log the failure
        # loudly rather than silently proceeding as if nothing happened.
        logger.warning(f"Agmarknet ingestion failed, using existing price history only: {err}")
        price_history = price_history_store.load_price_history()

    try:
        trend_records = fetch_interest_over_time(
            settings.google_trends_keyword,
            settings.google_trends_years,
            settings.google_trends_geo,
        )
        trends_history = trends_history_store.append_snapshot(trend_records)
    except GoogleTrendsError as err:
        # Same "unreachable external API shouldn't block everything else"
        # convention as the Agmarknet fallback above.
        logger.warning(f"Google Trends ingestion failed, using existing history only: {err}")
        trends_history = trends_history_store.load_trends_history()

    sales_features = _build_sales_features(sales, festivals)
    price_features = _build_price_features(price_history)
    trends_features = _build_trends_features(trends_history)

    manifest = feature_store.write_features(sales_features, price_features, trends_features)
    manifest["products_count"] = len(products)
    manifest["sales_rows_ingested"] = len(sales)
    return manifest
