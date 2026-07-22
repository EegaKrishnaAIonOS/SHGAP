import pandas as pd

from app.config import settings
from app.market_intelligence import feature_store


def test_write_features_creates_both_parquet_files_and_a_manifest(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "feature_store_dir", str(tmp_path))
    sales_df = pd.DataFrame({"product_id": ["p1"], "total_quantity": [5]})
    price_df = pd.DataFrame({"commodity": ["Tomato"], "modal_price": [1250.0]})

    manifest = feature_store.write_features(sales_df, price_df)

    assert manifest["sales_features_rows"] == 1
    assert manifest["price_features_rows"] == 1
    assert (tmp_path / "sales_features.parquet").exists()
    assert (tmp_path / "price_features.parquet").exists()
    assert (tmp_path / "manifest.json").exists()


def test_read_manifest_returns_none_before_any_run(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "feature_store_dir", str(tmp_path))
    assert feature_store.read_manifest() is None


def test_read_manifest_returns_what_was_written(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "feature_store_dir", str(tmp_path))
    feature_store.write_features(pd.DataFrame({"a": [1]}), pd.DataFrame({"b": [2]}))

    manifest = feature_store.read_manifest()
    assert manifest["sales_features_rows"] == 1
    assert manifest["price_features_rows"] == 1
    assert "last_run_at" in manifest
