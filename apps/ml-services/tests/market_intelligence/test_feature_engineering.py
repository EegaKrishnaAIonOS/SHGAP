import pandas as pd
import pytest

from app.market_intelligence.feature_engineering import (
    add_festival_features,
    add_geo_features,
    add_lag_features,
    add_seasonality_features,
)
from app.market_intelligence.repository import FestivalRecord


class TestSeasonalityFeatures:
    def test_flags_weekends_correctly(self):
        df = pd.DataFrame({"date": ["2026-07-18", "2026-07-19", "2026-07-20"]})  # Sat, Sun, Mon
        result = add_seasonality_features(df, date_col="date")
        assert result["is_weekend"].tolist() == [True, True, False]

    def test_cyclical_encoding_makes_december_and_january_close(self):
        # December and June are the two calendar months furthest apart
        # (opposite sides of the 12-month cycle) — December and January are
        # adjacent (one month apart) and so should be far closer than that,
        # even though they're numerically 11 apart as plain integers.
        df = pd.DataFrame({"date": ["2026-12-31", "2026-01-01", "2026-06-15"]})
        result = add_seasonality_features(df, date_col="date")

        def vec(i):
            return (result.loc[i, "month_sin"], result.loc[i, "month_cos"])

        def distance(a, b):
            return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5

        dec_to_jan = distance(vec(0), vec(1))
        dec_to_june = distance(vec(0), vec(2))
        assert dec_to_jan < dec_to_june


class TestFestivalFeatures:
    FESTIVALS = [
        FestivalRecord(
            name="Sankranti", start_date="2026-01-14", end_date="2026-01-16", district_id=None
        ),
        FestivalRecord(
            name="District Fair",
            start_date="2026-03-01",
            end_date="2026-03-02",
            district_id="district-1",
        ),
    ]

    def test_marks_dates_inside_a_statewide_festival_window(self):
        df = pd.DataFrame({"date": ["2026-01-15"], "district_id": ["district-2"]})
        result = add_festival_features(df, "date", "district_id", self.FESTIVALS)
        assert result.loc[0, "days_to_nearest_festival"] == 0
        assert result.loc[0, "is_festival_window"]

    def test_district_specific_festival_does_not_apply_to_other_districts(self):
        df = pd.DataFrame({"date": ["2026-03-01"], "district_id": ["district-2"]})
        result = add_festival_features(df, "date", "district_id", self.FESTIVALS)
        # District Fair doesn't apply to district-2, so only the distant Sankranti counts.
        assert result.loc[0, "days_to_nearest_festival"] != 0

    def test_district_specific_festival_applies_to_its_own_district(self):
        df = pd.DataFrame({"date": ["2026-03-01"], "district_id": ["district-1"]})
        result = add_festival_features(df, "date", "district_id", self.FESTIVALS)
        assert result.loc[0, "days_to_nearest_festival"] == 0
        assert result.loc[0, "is_festival_window"]

    def test_far_from_any_festival_has_a_large_distance_and_no_window_flag(self):
        df = pd.DataFrame({"date": ["2026-06-15"], "district_id": ["district-2"]})
        result = add_festival_features(df, "date", "district_id", self.FESTIVALS)
        assert abs(result.loc[0, "days_to_nearest_festival"]) > 30
        assert not result.loc[0, "is_festival_window"]

    def test_handles_no_festivals_at_all(self):
        df = pd.DataFrame({"date": ["2026-06-15"], "district_id": ["district-2"]})
        result = add_festival_features(df, "date", "district_id", [])
        assert result.loc[0, "days_to_nearest_festival"] == 9999
        assert not result.loc[0, "is_festival_window"]


class TestGeoFeatures:
    def test_computes_an_h3_cell_for_real_coordinates(self):
        df = pd.DataFrame({"lat": [14.6819], "lng": [77.6006]})
        result = add_geo_features(df, lat_col="lat", lng_col="lng")
        assert result.loc[0, "h3_cell"] is not None
        assert isinstance(result.loc[0, "h3_cell"], str)

    def test_missing_coordinates_yield_no_cell_rather_than_raising(self):
        df = pd.DataFrame({"lat": [None], "lng": [None]})
        result = add_geo_features(df, lat_col="lat", lng_col="lng")
        assert result.loc[0, "h3_cell"] is None


class TestLagFeatures:
    def test_lag_1_matches_the_previous_row_in_the_same_group(self):
        df = pd.DataFrame(
            {
                "product_id": ["p1", "p1", "p1"],
                "date": ["2026-01-01", "2026-01-02", "2026-01-03"],
                "quantity": [10, 20, 30],
            }
        )
        result = add_lag_features(
            df, ["product_id"], "date", "quantity", lags=(1,), rolling_windows=()
        )
        assert result["quantity_lag_1"].isna().tolist() == [True, False, False]
        assert result["quantity_lag_1"].iloc[1:].tolist() == [10, 20]

    def test_lag_does_not_leak_across_different_groups(self):
        df = pd.DataFrame(
            {
                "product_id": ["p1", "p2"],
                "date": ["2026-01-01", "2026-01-01"],
                "quantity": [10, 999],
            }
        )
        result = add_lag_features(
            df, ["product_id"], "date", "quantity", lags=(1,), rolling_windows=()
        )
        assert result["quantity_lag_1"].isna().all()

    def test_rolling_mean_only_uses_prior_days(self):
        df = pd.DataFrame(
            {
                "product_id": ["p1"] * 4,
                "date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"],
                "quantity": [10, 20, 30, 40],
            }
        )
        result = add_lag_features(
            df, ["product_id"], "date", "quantity", lags=(), rolling_windows=(2,)
        )
        # Day 4's rolling mean of the prior 2 days (day2=20, day3=30) = 25.
        assert result["quantity_rolling_mean_2"].iloc[3] == pytest.approx(25.0)
