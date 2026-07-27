from app.config import settings
from app.market_intelligence import demand_model
from app.market_intelligence.repository import FestivalRecord


def estimate_expected_demand(product_id: str, festivals: list[FestivalRecord]) -> float | None:
    """Reuses T15's already-trained per-product Prophet demand model rather
    than inventing a separate estimate for recommendations — `expectedDemand`
    is the sum of predicted quantity over the next
    `settings.expected_demand_horizon_days`. Returns `None` (not a fabricated
    number) when this product doesn't have a registered demand model yet
    (below T15's own minimum-training-days threshold) — the API honestly
    reports "we don't know" rather than guessing."""
    forecast = demand_model.forecast(product_id, settings.expected_demand_horizon_days, festivals)
    if forecast is None:
        return None
    return round(sum(row["predicted_quantity"] for row in forecast["forecast"]), 2)
