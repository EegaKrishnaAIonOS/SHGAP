from unittest.mock import AsyncMock, patch

import pandas as pd

from app.market_intelligence.agmarknet_client import AgmarknetError, MandiPriceRecord
from app.market_intelligence.google_trends_client import GoogleTrendsError, TrendRecord
from app.market_intelligence.pipeline import run_feature_pipeline
from app.market_intelligence.repository import ProductRecord, SaleRecord


def _sale(**overrides) -> SaleRecord:
    defaults = dict(
        id="sale-1",
        product_id="prod-1",
        shg_id="shg-1",
        district_id="district-1",
        category_id="cat-1",
        quantity=2.0,
        unit_price=150.0,
        total_amount=300.0,
        sale_date="2026-07-15",
        lng=77.6006,
        lat=14.6819,
    )
    defaults.update(overrides)
    return SaleRecord(**defaults)


def _price(**overrides) -> MandiPriceRecord:
    defaults = dict(
        state="Andhra Pradesh",
        district="Anantapur",
        market="Anantapur APMC",
        commodity="Tomato",
        variety="Hybrid",
        arrival_date="15/07/2026",
        min_price=1000.0,
        max_price=1500.0,
        modal_price=1250.0,
    )
    defaults.update(overrides)
    return MandiPriceRecord(**defaults)


def _trend(**overrides) -> TrendRecord:
    defaults = dict(
        keyword="SHG products India",
        date="2026-07-12",
        interest=42.0,
        is_partial=False,
    )
    defaults.update(overrides)
    return TrendRecord(**defaults)


async def test_pipeline_writes_features_from_real_sales_agmarknet_and_trends_data(tmp_path):
    product = ProductRecord(
        id="prod-1",
        shg_id="shg-1",
        category_id="cat-1",
        district_id="district-1",
        name="Mango Pickle",
        price=150.0,
        lng=77.6,
        lat=14.6,
    )
    with (
        patch(
            "app.market_intelligence.pipeline.fetch_sales", new=AsyncMock(return_value=[_sale()])
        ),
        patch(
            "app.market_intelligence.pipeline.fetch_festivals", new=AsyncMock(return_value=[])
        ),
        patch(
            "app.market_intelligence.pipeline.fetch_products",
            new=AsyncMock(return_value=[product]),
        ),
        patch("app.market_intelligence.pipeline.fetch_daily_prices", return_value=[_price()]),
        patch(
            "app.market_intelligence.pipeline.fetch_interest_over_time",
            return_value=[_trend()],
        ),
        patch("app.market_intelligence.price_history_store.settings") as mock_settings,
        patch("app.market_intelligence.trends_history_store.settings") as mock_trends_settings,
        patch("app.market_intelligence.feature_store.settings") as mock_fs_settings,
    ):
        mock_settings.price_history_dir = str(tmp_path / "price_history")
        mock_trends_settings.trends_history_dir = str(tmp_path / "trends_history")
        mock_fs_settings.feature_store_dir = str(tmp_path / "features")

        manifest = await run_feature_pipeline()

    assert manifest["sales_rows_ingested"] == 1
    assert manifest["products_count"] == 1
    assert manifest["sales_features_rows"] == 1  # one product, one day
    assert manifest["price_features_rows"] == 1
    assert manifest["trends_features_rows"] == 1


async def test_pipeline_falls_back_to_existing_price_and_trends_history_when_apis_fail(tmp_path):
    with (
        patch("app.market_intelligence.pipeline.fetch_sales", new=AsyncMock(return_value=[])),
        patch("app.market_intelligence.pipeline.fetch_festivals", new=AsyncMock(return_value=[])),
        patch("app.market_intelligence.pipeline.fetch_products", new=AsyncMock(return_value=[])),
        patch(
            "app.market_intelligence.pipeline.fetch_daily_prices",
            side_effect=AgmarknetError("unauthorised"),
        ),
        patch(
            "app.market_intelligence.pipeline.fetch_interest_over_time",
            side_effect=GoogleTrendsError("rate-limited"),
        ),
        patch("app.market_intelligence.price_history_store.settings") as mock_settings,
        patch("app.market_intelligence.trends_history_store.settings") as mock_trends_settings,
        patch("app.market_intelligence.feature_store.settings") as mock_fs_settings,
    ):
        mock_settings.price_history_dir = str(tmp_path / "price_history")
        mock_trends_settings.trends_history_dir = str(tmp_path / "trends_history")
        mock_fs_settings.feature_store_dir = str(tmp_path / "features")

        manifest = await run_feature_pipeline()

    # No prior history and a failed call -> empty (not crashed) feature tables.
    assert manifest["price_features_rows"] == 0
    assert manifest["sales_features_rows"] == 0
    assert manifest["trends_features_rows"] == 0


def test_build_sales_features_handles_no_sales():
    from app.market_intelligence.pipeline import _build_sales_features

    result = _build_sales_features([], [])
    assert isinstance(result, pd.DataFrame)
    assert result.empty
