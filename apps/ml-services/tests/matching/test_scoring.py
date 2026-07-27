import pytest

from app.matching.scoring import (
    MatchComponents,
    category_interest_score,
    compute_distance_km,
    geo_proximity_score,
    haversine_km,
    price_band_score,
)


class TestHaversine:
    def test_same_point_is_zero_distance(self):
        assert haversine_km(16.5, 80.6, 16.5, 80.6) == pytest.approx(0.0, abs=1e-6)

    def test_known_real_world_distance(self):
        # Anantapur (~14.68, 77.60) to Visakhapatnam (~17.69, 83.22) is
        # roughly 650-700km as the crow flies.
        distance = haversine_km(14.6819, 77.6006, 17.6868, 83.2185)
        assert 650 < distance < 720


class TestCategoryInterestScore:
    def test_full_score_when_category_is_declared(self):
        assert category_interest_score("cat-1", ["cat-1", "cat-2"]) == 1.0

    def test_zero_when_category_not_declared(self):
        assert category_interest_score("cat-3", ["cat-1", "cat-2"]) == 0.0

    def test_zero_when_buyer_has_no_declared_interests(self):
        assert category_interest_score("cat-1", []) == 0.0


class TestPriceBandScore:
    def test_full_score_inside_the_band(self):
        assert price_band_score(150, 100, 300) == 1.0

    def test_neutral_when_no_band_stated_at_all(self):
        assert price_band_score(150, None, None) == 0.5

    def test_tapers_down_below_the_band(self):
        # Band [100, 300], width 200, taper distance 400. Price 50 is 50
        # below the low edge -> 1 - 50/400 = 0.875.
        assert price_band_score(50, 100, 300) == pytest.approx(0.875)

    def test_tapers_down_above_the_band(self):
        assert price_band_score(350, 100, 300) == pytest.approx(0.875)

    def test_never_goes_negative_far_outside_the_band(self):
        assert price_band_score(10000, 100, 300) == 0.0


class TestGeoProximityScore:
    def test_none_when_distance_is_none(self):
        assert geo_proximity_score(None) is None

    def test_full_score_at_zero_distance(self):
        assert geo_proximity_score(0.0) == 1.0

    def test_decreases_with_distance(self):
        near = geo_proximity_score(10.0)
        far = geo_proximity_score(100.0)
        assert near > far

    def test_never_goes_negative_far_away(self):
        assert geo_proximity_score(10000.0) == 0.0


class TestComputeDistanceKm:
    def test_none_when_any_coordinate_is_missing(self):
        assert compute_distance_km(None, 80.0, 16.0, 80.0) is None
        assert compute_distance_km(16.0, None, 16.0, 80.0) is None
        assert compute_distance_km(16.0, 80.0, None, 80.0) is None
        assert compute_distance_km(16.0, 80.0, 16.0, None) is None

    def test_computes_a_real_distance_when_all_present(self):
        distance = compute_distance_km(14.6819, 77.6006, 17.6868, 83.2185)
        assert distance is not None
        assert distance > 0


class TestMatchComponentsWeightedScore:
    def test_perfect_match_scores_near_one(self):
        components = MatchComponents(
            content_similarity=1.0, category_interest=1.0, price_band_fit=1.0, geo_proximity=1.0
        )
        assert components.weighted_score() == pytest.approx(1.0)

    def test_worst_match_scores_near_zero(self):
        components = MatchComponents(
            content_similarity=0.0, category_interest=0.0, price_band_fit=0.0, geo_proximity=0.0
        )
        assert components.weighted_score() == pytest.approx(0.0)

    def test_missing_geo_defaults_to_neutral_not_zero(self):
        with_geo = MatchComponents(
            content_similarity=0.5, category_interest=0.5, price_band_fit=0.5, geo_proximity=0.0
        )
        without_geo = MatchComponents(
            content_similarity=0.5, category_interest=0.5, price_band_fit=0.5, geo_proximity=None
        )
        # geo_proximity=None (unknown) should score higher than a confirmed
        # geo_proximity=0.0 (confirmed far away) — neutral, not a penalty.
        assert without_geo.weighted_score() > with_geo.weighted_score()
