from dataclasses import dataclass

from pytrends.request import TrendReq


@dataclass(frozen=True)
class TrendRecord:
    keyword: str
    date: str  # ISO date (YYYY-MM-DD)
    interest: float  # Google's 0-100 relative search-interest score
    is_partial: bool  # true for the most recent point if that week/day isn't over yet


class GoogleTrendsError(Exception):
    """Google Trends is unreachable, rate-limited, or returned no data."""


def fetch_interest_over_time(keyword: str, years: int, geo: str) -> list[TrendRecord]:
    """Fetches `years` of real Google Trends search-interest history for
    `keyword` via `pytrends` (there is no official public Trends API — this
    is the same unofficial client the wider community uses, scraping the
    same public trends.google.com endpoints the web UI calls).

    A `years`-long window comes back at weekly resolution (Trends drops to
    daily only for windows under ~90 days, and to monthly beyond ~5 years) —
    that's Trends' own behavior, not something this client controls or can
    request otherwise. Values are relative (0-100, scaled to the highest
    point in the returned window), not absolute search volume — Google
    doesn't expose absolute counts through this or any other public
    interface.
    """
    try:
        pytrends = TrendReq(hl="en-US", tz=330)  # tz=330 = IST (UTC+5:30)
        pytrends.build_payload([keyword], timeframe=f"today {years}-y", geo=geo)
        df = pytrends.interest_over_time()
    except Exception as err:  # noqa: BLE001 - pytrends raises assorted requests/urllib3 errors
        raise GoogleTrendsError(f"Google Trends unreachable or rate-limited: {err}") from err

    if df is None or df.empty:
        raise GoogleTrendsError(f"Google Trends returned no data for keyword '{keyword}'")

    df = df.reset_index()
    return [
        TrendRecord(
            keyword=keyword,
            date=row["date"].strftime("%Y-%m-%d"),
            interest=float(row[keyword]),
            is_partial=bool(row["isPartial"]) if "isPartial" in df.columns else False,
        )
        for _, row in df.iterrows()
    ]