from dataclasses import dataclass

import requests

from app.config import settings

AGMARKNET_BASE_URL = "https://api.data.gov.in/resource"

# The shared public demo API key (see config.py) is hard-capped at 10 records
# per call regardless of the requested `limit` — verified directly against
# the real API, which echoes back `"limit": "10"` even when 500 is
# requested. Paginating via `offset` is the only way to get more than one
# page's worth per run; this bounds the total pages fetched per run so a
# very large `total` (e.g. querying with no state filter at all) can't turn
# one pipeline run into hundreds of sequential HTTP calls.
PAGE_SIZE = 10
MAX_PAGES_PER_RUN = 20


@dataclass(frozen=True)
class MandiPriceRecord:
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    arrival_date: str  # as returned by the API, DD/MM/YYYY
    min_price: float
    max_price: float
    modal_price: float


class AgmarknetError(Exception):
    """The Agmarknet API is unreachable or returned an error."""


def _fetch_page(state: str, offset: int) -> dict:
    try:
        response = requests.get(
            f"{AGMARKNET_BASE_URL}/{settings.agmarknet_resource_id}",
            params={
                "api-key": settings.agmarknet_api_key,
                "format": "json",
                "limit": PAGE_SIZE,
                "offset": offset,
                "filters[state]": state,
            },
            # data.gov.in's infrastructure silently times out (no error, no
            # response — just hangs until the client gives up) any request
            # whose User-Agent contains the default "python-requests/x.y"
            # signature — verified directly by testing several UA strings
            # against the real API. Any other value works fine, including
            # this one; it isn't spoofing a browser, just avoiding that one
            # specific blocked signature.
            headers={"User-Agent": "SHGAP-ml-services/0.1"},
            timeout=30,
        )
    except requests.RequestException as err:
        raise AgmarknetError(f"Agmarknet API unreachable: {err}") from err

    if response.status_code != 200:
        raise AgmarknetError(f"Agmarknet API returned {response.status_code}: {response.text}")

    body = response.json()
    if body.get("status") != "ok" or "error" in body:
        raise AgmarknetError(f"Agmarknet API error: {body.get('error') or body}")
    return body


def fetch_daily_prices(state: str) -> list[MandiPriceRecord]:
    """Fetches *today's* mandi (market) prices for `state` from data.gov.in's
    real "Current Daily Price of Various Commodities from Various Markets
    (Mandi)" dataset (Ministry of Agriculture and Farmers Welfare), paging
    through up to `MAX_PAGES_PER_RUN` pages of `PAGE_SIZE` records each.

    This is a live daily snapshot, not a queryable historical archive — the
    API silently ignores date filters and always returns the current day's
    data (verified directly against the real API, not assumed). Building a
    real multi-day price history therefore means calling this once a day and
    accumulating the results ourselves — see `price_history_store.py` and
    ADR-0023's "Agmarknet is a snapshot, not a queryable archive" note.
    """
    records: list[MandiPriceRecord] = []
    offset = 0
    total = None

    for _ in range(MAX_PAGES_PER_RUN):
        body = _fetch_page(state, offset)
        total = body.get("total", 0)
        page_records = body.get("records", [])
        records.extend(
            MandiPriceRecord(
                state=record["state"],
                district=record["district"],
                market=record["market"],
                commodity=record["commodity"],
                variety=record["variety"],
                arrival_date=record["arrival_date"],
                min_price=float(record["min_price"]),
                max_price=float(record["max_price"]),
                modal_price=float(record["modal_price"]),
            )
            for record in page_records
        )
        offset += len(page_records)
        if not page_records or offset >= total:
            break

    return records
