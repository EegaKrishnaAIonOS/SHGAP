import os

import pandas as pd

from app.config import settings
from app.market_intelligence.google_trends_client import TrendRecord

HISTORY_FILE = "google_trends_history.parquet"
_DEDUPE_KEYS = ["keyword", "date"]


def _history_path() -> str:
    os.makedirs(settings.trends_history_dir, exist_ok=True)
    return os.path.join(settings.trends_history_dir, HISTORY_FILE)


def append_snapshot(records: list[TrendRecord]) -> pd.DataFrame:
    """Merges a freshly-fetched Google Trends window into our own local
    historical archive and returns the full accumulated history.

    Unlike Agmarknet (a true daily-only snapshot, see agmarknet_client.py),
    each Google Trends call already returns its whole multi-year window —
    this still dedupes by (keyword, date) keeping the newest value rather
    than just overwriting the file outright, so a run that only partially
    succeeds, or a keyword change, never silently drops previously-fetched
    history for other dates/keywords.
    """
    new_rows = pd.DataFrame([vars(r) for r in records])
    path = _history_path()

    if os.path.exists(path):
        existing = pd.read_parquet(path)
        combined = pd.concat([existing, new_rows], ignore_index=True)
    else:
        combined = new_rows

    if not combined.empty:
        combined = combined.drop_duplicates(subset=_DEDUPE_KEYS, keep="last")

    combined.to_parquet(path, index=False)
    return combined


def load_trends_history() -> pd.DataFrame:
    path = _history_path()
    if not os.path.exists(path):
        return pd.DataFrame(columns=[*_DEDUPE_KEYS, "interest", "is_partial"])
    return pd.read_parquet(path)