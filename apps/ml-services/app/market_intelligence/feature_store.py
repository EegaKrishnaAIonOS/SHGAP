import json
import os
from datetime import datetime, timezone

import pandas as pd

from app.config import settings

SALES_FEATURES_FILE = "sales_features.parquet"
PRICE_FEATURES_FILE = "price_features.parquet"
MANIFEST_FILE = "manifest.json"


def _store_dir() -> str:
    os.makedirs(settings.feature_store_dir, exist_ok=True)
    return settings.feature_store_dir


def write_features(sales_features: pd.DataFrame, price_features: pd.DataFrame) -> dict:
    """Writes both feature tables to Parquet and a manifest recording when
    this ran and how many rows each table has — read back by
    `read_manifest()` (the `/market-intelligence/feature-status` endpoint)
    so freshness/row counts are inspectable without opening the Parquet
    files directly."""
    store_dir = _store_dir()
    sales_path = os.path.join(store_dir, SALES_FEATURES_FILE)
    price_path = os.path.join(store_dir, PRICE_FEATURES_FILE)

    sales_features.to_parquet(sales_path, index=False)
    price_features.to_parquet(price_path, index=False)

    manifest = {
        "last_run_at": datetime.now(timezone.utc).isoformat(),
        "sales_features_rows": len(sales_features),
        "price_features_rows": len(price_features),
        "sales_features_path": sales_path,
        "price_features_path": price_path,
    }
    with open(os.path.join(store_dir, MANIFEST_FILE), "w") as f:
        json.dump(manifest, f, indent=2)

    return manifest


def read_manifest() -> dict | None:
    path = os.path.join(_store_dir(), MANIFEST_FILE)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def read_features() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Reads back the two feature tables the pipeline wrote — used by T15's
    training pipeline, which trains on whatever T14's pipeline last
    produced rather than re-deriving features itself. Returns two empty
    frames if the feature pipeline has never run yet, so a caller can
    still proceed (and correctly find "not enough data") instead of
    crashing on a missing file."""
    store_dir = _store_dir()
    sales_path = os.path.join(store_dir, SALES_FEATURES_FILE)
    price_path = os.path.join(store_dir, PRICE_FEATURES_FILE)

    sales = pd.read_parquet(sales_path) if os.path.exists(sales_path) else pd.DataFrame()
    price = pd.read_parquet(price_path) if os.path.exists(price_path) else pd.DataFrame()
    return sales, price
