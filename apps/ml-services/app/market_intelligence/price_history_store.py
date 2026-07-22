import os

import pandas as pd

from app.config import settings
from app.market_intelligence.agmarknet_client import MandiPriceRecord

HISTORY_FILE = "agmarknet_price_history.parquet"
_DEDUPE_KEYS = ["state", "district", "market", "commodity", "variety", "arrival_date"]


def _history_path() -> str:
    os.makedirs(settings.price_history_dir, exist_ok=True)
    return os.path.join(settings.price_history_dir, HISTORY_FILE)


def append_daily_snapshot(records: list[MandiPriceRecord]) -> pd.DataFrame:
    """Appends today's Agmarknet snapshot to our own local historical
    archive and returns the full accumulated history.

    Agmarknet's API only ever serves *today's* prices (verified directly —
    see agmarknet_client.py) — it has no queryable date range. So a real
    multi-day price history only exists because this function is called
    once per pipeline run and keeps what it's seen. On a fresh environment,
    or right after this feature first started running, that history is
    just one day deep; lag/rolling price features will be mostly NaN until
    enough daily runs have accumulated. That's an honest limitation of a
    freshly-started ingestion job, not a bug — see ADR-0023.
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


def load_price_history() -> pd.DataFrame:
    path = _history_path()
    if not os.path.exists(path):
        return pd.DataFrame(columns=[*_DEDUPE_KEYS, "min_price", "max_price", "modal_price"])
    return pd.read_parquet(path)
