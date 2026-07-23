import json
import os
from datetime import datetime, timezone

from app.config import settings

MANIFEST_FILE = "manifest.json"


def models_dir() -> str:
    os.makedirs(settings.model_registry_dir, exist_ok=True)
    return settings.model_registry_dir


def model_path(name: str, extension: str) -> str:
    """A file path under the registry directory for a model artifact —
    each model type serializes itself using its own library's recommended
    format (Prophet's `model_to_json`, XGBoost's native `save_model`)
    rather than raw pickling, which is fragile across library versions.
    This module only manages *where* those files live and their metadata,
    not how each library (de)serializes its own model object.
    """
    return os.path.join(models_dir(), f"{name}.{extension}")


def write_manifest_entry(model_type: str, key: str, metadata: dict) -> dict:
    """Merges one entry into the shared registry manifest, keyed by
    `{model_type}:{key}` (e.g. `demand:<product_id>`, `price:pooled`) —
    lets `/forecast/demand` etc. check "is there a trained model for this"
    and report its metrics/training date without loading the model itself.
    """
    manifest = read_manifest()
    entry = {**metadata, "trained_at": datetime.now(timezone.utc).isoformat()}
    manifest[f"{model_type}:{key}"] = entry
    with open(_manifest_path(), "w") as f:
        json.dump(manifest, f, indent=2, default=str)
    return entry


def read_manifest() -> dict:
    path = _manifest_path()
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


def read_manifest_entry(model_type: str, key: str) -> dict | None:
    return read_manifest().get(f"{model_type}:{key}")


def clear_manifest_entries(model_type: str) -> None:
    """Drops every entry for `model_type` before a fresh training run
    writes new ones — so a product that no longer meets the minimum-data
    threshold doesn't leave a stale, no-longer-true manifest entry behind."""
    manifest = read_manifest()
    for key in [k for k in manifest if k.startswith(f"{model_type}:")]:
        del manifest[key]
    with open(_manifest_path(), "w") as f:
        json.dump(manifest, f, indent=2, default=str)


def _manifest_path() -> str:
    return os.path.join(models_dir(), MANIFEST_FILE)
