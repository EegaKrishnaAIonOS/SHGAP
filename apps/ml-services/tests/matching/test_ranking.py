import numpy as np

from app.config import settings
from app.matching import ranking
from app.matching.repository import RecommendationFeedbackRecord


def _feedback_row(accepted: bool, seed: int) -> RecommendationFeedbackRecord:
    rng = np.random.default_rng(seed)
    # Accepted rows get a genuinely stronger signal than rejected ones, so a
    # real classifier has something learnable to fit — not just noise.
    base = 0.7 if accepted else 0.2
    return RecommendationFeedbackRecord(
        components={
            "content_similarity": float(np.clip(base + rng.normal(0, 0.1), 0, 1)),
            "category_interest": 1.0 if accepted else 0.0,
            "price_band_fit": float(np.clip(base + rng.normal(0, 0.1), 0, 1)),
            "geo_proximity": float(np.clip(base + rng.normal(0, 0.1), 0, 1)),
        },
        accepted=accepted,
    )


class TestTrain:
    def test_returns_none_below_minimum_feedback_rows(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_feedback_rows_for_ranker", 30)
        feedback = [_feedback_row(True, i) for i in range(5)]
        assert ranking.train(feedback) is None

    def test_trains_and_registers_with_enough_feedback(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_feedback_rows_for_ranker", 30)
        feedback = [_feedback_row(i % 2 == 0, i) for i in range(40)]

        result = ranking.train(feedback)

        assert result is not None
        assert result["training_rows"] == 40
        assert (tmp_path / "matching_ranker_pooled.txt").exists()


class TestScore:
    def test_returns_none_when_no_ranker_is_registered(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        components = {
            "content_similarity": 0.8,
            "category_interest": 1.0,
            "price_band_fit": 0.9,
            "geo_proximity": 0.7,
        }
        assert ranking.score(components) is None

    def test_scores_a_strong_candidate_higher_than_a_weak_one_after_training(
        self, monkeypatch, tmp_path
    ):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_feedback_rows_for_ranker", 30)
        feedback = [_feedback_row(i % 2 == 0, i) for i in range(40)]
        ranking.train(feedback)

        strong = ranking.score(
            {
                "content_similarity": 0.9,
                "category_interest": 1.0,
                "price_band_fit": 0.9,
                "geo_proximity": 0.9,
            }
        )
        weak = ranking.score(
            {
                "content_similarity": 0.1,
                "category_interest": 0.0,
                "price_band_fit": 0.1,
                "geo_proximity": 0.1,
            }
        )

        assert strong is not None and weak is not None
        assert strong > weak

    def test_handles_missing_geo_proximity_as_nan_not_a_crash(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
        monkeypatch.setattr(settings, "min_feedback_rows_for_ranker", 30)
        feedback = [_feedback_row(i % 2 == 0, i) for i in range(40)]
        ranking.train(feedback)

        result = ranking.score(
            {
                "content_similarity": 0.5,
                "category_interest": 0.5,
                "price_band_fit": 0.5,
                "geo_proximity": None,
            }
        )
        assert result is not None
