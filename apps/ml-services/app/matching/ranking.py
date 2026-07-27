import logging

import lightgbm as lgb
import numpy as np

from app.config import settings
from app.market_intelligence import model_registry
from app.matching.repository import RecommendationFeedbackRecord

logger = logging.getLogger(__name__)

MODEL_TYPE = "matching_ranker"
REGISTRY_KEY = "pooled"
FEATURE_NAMES = ["content_similarity", "category_interest", "price_band_fit", "geo_proximity"]


def _to_feature_row(components: dict) -> list[float]:
    # geo_proximity is stored as `None` in components when no location was
    # available on either side (see scoring.py) — LightGBM handles NaN
    # natively as "missing" (same reasoning as T15's price model), so this
    # is passed through rather than defaulted to some arbitrary number.
    return [
        components.get("content_similarity", 0.0),
        components.get("category_interest", 0.0),
        components.get("price_band_fit", 0.5),
        components.get("geo_proximity") if components.get("geo_proximity") is not None else np.nan,
    ]


def train(feedback: list[RecommendationFeedbackRecord]) -> dict | None:
    """Trains a pooled LightGBM classifier on real accept/reject feedback —
    returns `None` (and trains nothing) below
    `settings.min_feedback_rows_for_ranker`, since a ranker fit on a
    handful of real labels would be memorizing noise, not learning a
    genuine preference signal. See ADR-0026."""
    model_registry.clear_manifest_entries(MODEL_TYPE)
    if len(feedback) < settings.min_feedback_rows_for_ranker:
        logger.info(
            f"Skipping matching ranker: {len(feedback)} accumulated feedback rows "
            f"(need {settings.min_feedback_rows_for_ranker})."
        )
        return None

    X = np.array([_to_feature_row(f.components) for f in feedback])
    y = np.array([1 if f.accepted else 0 for f in feedback])

    model = lgb.LGBMClassifier(n_estimators=100, max_depth=4, min_child_samples=5, verbose=-1)
    model.fit(X, y)
    model.booster_.save_model(model_registry.model_path(f"{MODEL_TYPE}_{REGISTRY_KEY}", "txt"))

    return model_registry.write_manifest_entry(
        MODEL_TYPE,
        REGISTRY_KEY,
        {"training_rows": len(feedback), "accepted_rows": int(y.sum())},
    )


def score(components: dict) -> float | None:
    """Returns the trained ranker's predicted accept-probability for one
    candidate, or `None` if no ranker is registered yet — the caller falls
    back to `MatchComponents.weighted_score()` in that case rather than a
    fabricated model output."""
    entry = model_registry.read_manifest_entry(MODEL_TYPE, REGISTRY_KEY)
    if entry is None:
        return None

    model_path = model_registry.model_path(f"{MODEL_TYPE}_{REGISTRY_KEY}", "txt")
    booster = lgb.Booster(model_file=model_path)
    row = np.array([_to_feature_row(components)])
    return float(booster.predict(row)[0])
