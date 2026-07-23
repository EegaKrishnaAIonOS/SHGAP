import math
from datetime import date, datetime

import h3
import pandas as pd

from app.market_intelligence.repository import FestivalRecord

# H3 resolution 7 cells are ~5 km2 — coarse enough that a handful of SHGs in
# the same town share a cell (useful for "hotspot" aggregation, T15's job),
# fine enough to still distinguish the three pilot districts from each other.
H3_RESOLUTION = 7

# A festival's demand effect isn't a single day — this is the window (each
# side of start/end) treated as "festival-adjacent" for the is_festival_window
# flag. Chosen as a reasonable starting point for a POC, not derived from any
# real historical measurement (there's no real multi-year sales history yet
# to measure it against) — see ADR-0023.
FESTIVAL_WINDOW_DAYS = 5


def add_seasonality_features(df: pd.DataFrame, date_col: str) -> pd.DataFrame:
    """Day-of-week/month features, including cyclical (sin/cos) encodings so
    a model sees December and January as adjacent rather than far apart."""
    df = df.copy()
    dt = pd.to_datetime(df[date_col])
    df["day_of_week"] = dt.dt.dayofweek
    df["month"] = dt.dt.month
    df["is_weekend"] = dt.dt.dayofweek.isin([5, 6])
    df["day_of_week_sin"] = _cyclical_sin(dt.dt.dayofweek, period=7)
    df["day_of_week_cos"] = _cyclical_cos(dt.dt.dayofweek, period=7)
    df["month_sin"] = _cyclical_sin(dt.dt.month - 1, period=12)
    df["month_cos"] = _cyclical_cos(dt.dt.month - 1, period=12)
    return df


def _cyclical_sin(series: pd.Series, period: int) -> pd.Series:
    return (2 * math.pi * series / period).apply(math.sin)


def _cyclical_cos(series: pd.Series, period: int) -> pd.Series:
    return (2 * math.pi * series / period).apply(math.cos)


def add_festival_features(
    df: pd.DataFrame,
    date_col: str,
    district_col: str,
    festivals: list[FestivalRecord],
) -> pd.DataFrame:
    """`days_to_nearest_festival` (signed: negative = festival already
    passed, positive = upcoming) and `is_festival_window` (within
    `FESTIVAL_WINDOW_DAYS` of a festival that applies to the row's district,
    or a statewide festival with no `district_id`)."""
    df = df.copy()
    dates = pd.to_datetime(df[date_col]).dt.date

    parsed = [
        (
            datetime.fromisoformat(f.start_date).date(),
            datetime.fromisoformat(f.end_date).date(),
            f.district_id,
        )
        for f in festivals
    ]

    def nearest_and_window(row_date: date, row_district: str) -> tuple[int, bool]:
        applicable = [
            (start, end)
            for start, end, district_id in parsed
            if district_id in (None, row_district)
        ]
        if not applicable:
            return 9999, False

        signed_distances = []
        in_window = False
        for start, end in applicable:
            if start <= row_date <= end:
                signed_distances.append(0)
                in_window = True
                continue
            days_to_start = (start - row_date).days
            days_from_end = (row_date - end).days
            if row_date < start:
                signed_distances.append(days_to_start)
                if days_to_start <= FESTIVAL_WINDOW_DAYS:
                    in_window = True
            else:
                signed_distances.append(-days_from_end)
                if days_from_end <= FESTIVAL_WINDOW_DAYS:
                    in_window = True

        nearest = min(signed_distances, key=abs)
        return nearest, in_window

    results = [nearest_and_window(d, dist) for d, dist in zip(dates, df[district_col])]
    df["days_to_nearest_festival"] = [r[0] for r in results]
    df["is_festival_window"] = [r[1] for r in results]
    return df


def add_geo_features(df: pd.DataFrame, lat_col: str, lng_col: str) -> pd.DataFrame:
    """H3 cell index per row, computed from each row's real lat/lng (the
    product/SHG's actual registered location, not a district centroid —
    districts don't carry their own coordinates in this schema)."""
    df = df.copy()
    df["h3_cell"] = [
        h3.latlng_to_cell(lat, lng, H3_RESOLUTION) if pd.notna(lat) and pd.notna(lng) else None
        for lat, lng in zip(df[lat_col], df[lng_col])
    ]
    return df


def add_lag_features(
    df: pd.DataFrame,
    group_cols: list[str],
    date_col: str,
    value_col: str,
    lags: tuple[int, ...] = (1, 7, 28),
    rolling_windows: tuple[int, ...] = (7, 28),
) -> pd.DataFrame:
    """Per-group (e.g. per product) lag and rolling-mean features — sorted by
    date within each group first, since lag only means something in time
    order. Early rows in a short history will have NaN lags; that's an
    honest reflection of not having enough history yet, not a bug to hide.

    `group_cols=[]` means "the whole dataframe is already one series" (e.g.
    price_model.py's recursive forecast, which pre-filters to a single
    commodity/market before calling this) — `df.groupby([])` itself raises
    `ValueError: No group keys passed!` in pandas, so that case is handled
    directly on `df[value_col]` rather than through groupby at all.
    """
    def _rolling_mean(s: pd.Series, window: int) -> pd.Series:
        return s.shift(1).rolling(window=window, min_periods=1).mean()

    df = df.sort_values(by=[*group_cols, date_col]).copy()

    if not group_cols:
        for lag in lags:
            df[f"{value_col}_lag_{lag}"] = df[value_col].shift(lag)
        for window in rolling_windows:
            df[f"{value_col}_rolling_mean_{window}"] = _rolling_mean(df[value_col], window)
        return df

    grouped = df.groupby(group_cols)[value_col]
    for lag in lags:
        df[f"{value_col}_lag_{lag}"] = grouped.shift(lag)
    for window in rolling_windows:
        df[f"{value_col}_rolling_mean_{window}"] = grouped.transform(
            lambda s, w=window: _rolling_mean(s, w)
        )
    return df
