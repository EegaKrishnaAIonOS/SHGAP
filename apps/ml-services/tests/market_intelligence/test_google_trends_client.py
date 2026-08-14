from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.market_intelligence.google_trends_client import (
    GoogleTrendsError,
    fetch_interest_over_time,
)

TREND_REQ = "app.market_intelligence.google_trends_client.TrendReq"


def _fake_pytrends(df: pd.DataFrame) -> MagicMock:
    instance = MagicMock()
    instance.interest_over_time.return_value = df
    return instance


def _interest_df(keyword="SHG products India"):
    return pd.DataFrame(
        {
            keyword: [10, 20, 30],
            "isPartial": [False, False, True],
        },
        index=pd.to_datetime(["2026-01-04", "2026-01-11", "2026-01-18"]),
    ).rename_axis("date")


class TestFetchInterestOverTime:
    def test_parses_the_response_into_dataclasses(self):
        with patch(TREND_REQ, return_value=_fake_pytrends(_interest_df())):
            results = fetch_interest_over_time("SHG products India", years=5, geo="IN")

        assert len(results) == 3
        assert results[0].keyword == "SHG products India"
        assert results[0].date == "2026-01-04"
        assert results[0].interest == 10.0
        assert results[0].is_partial is False
        assert results[2].is_partial is True

    def test_builds_the_payload_with_the_requested_keyword_years_and_geo(self):
        fake = _fake_pytrends(_interest_df(keyword="handloom sarees"))
        with patch(TREND_REQ, return_value=fake):
            fetch_interest_over_time("handloom sarees", years=5, geo="IN")

        fake.build_payload.assert_called_once_with(
            ["handloom sarees"], timeframe="today 5-y", geo="IN"
        )

    def test_raises_when_the_response_is_empty(self):
        with patch(TREND_REQ, return_value=_fake_pytrends(pd.DataFrame())):
            with pytest.raises(GoogleTrendsError):
                fetch_interest_over_time("SHG products India", years=5, geo="IN")

    def test_raises_on_transport_failure(self):
        with patch(TREND_REQ, side_effect=ConnectionError("refused")):
            with pytest.raises(GoogleTrendsError):
                fetch_interest_over_time("SHG products India", years=5, geo="IN")

    def test_missing_ispartial_column_defaults_to_false(self):
        df = _interest_df().drop(columns=["isPartial"])
        with patch(TREND_REQ, return_value=_fake_pytrends(df)):
            results = fetch_interest_over_time("SHG products India", years=5, geo="IN")

        assert all(r.is_partial is False for r in results)