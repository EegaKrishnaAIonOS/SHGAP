from app.matching.repository import BuyerRecord, ProductRecord
from app.matching.scoring import MatchComponents

# Below this, a component isn't worth mentioning as a reason — it's either
# genuinely weak (content_similarity) or a neutral "we don't know" value
# (price_band_fit/geo_proximity default to 0.5 when there's no data), not a
# real positive signal that should show up as a stated reason.
REASON_THRESHOLD = 0.6


def generate_template_reasons(
    components: MatchComponents,
    product: ProductRecord,
    buyer: BuyerRecord,
    distance_km: float | None,
    expected_demand: float | None,
) -> list[str]:
    """Human-readable explanations generated directly from the real,
    computed sub-scores — not SHAP values, since SHAP explains a *trained
    model's* predictions and no real ranker exists yet (see ranking.py).
    Once a ranker trains on real feedback, its SHAP output can be blended in
    alongside these; until then, this is the honest, always-available
    explanation path ADR-0009 also anticipated ("SHAP plus human-readable
    templates" — templates were never meant to be SHAP-only)."""
    reasons: list[str] = []

    if components.category_interest >= 1.0:
        reasons.append(
            f"{buyer.name} has expressed interest in {product.category_name}, "
            f"the category {product.name} belongs to."
        )

    if components.content_similarity >= REASON_THRESHOLD:
        reasons.append(
            f"{product.name} closely matches what {buyer.name} typically looks for."
        )

    if components.price_band_fit >= REASON_THRESHOLD:
        reasons.append(f"Priced at ₹{product.price:.0f}, within this buyer's usual range.")

    if distance_km is not None and components.geo_proximity is not None:
        if components.geo_proximity >= REASON_THRESHOLD:
            reasons.append(f"Only {distance_km:.0f} km from this buyer.")

    if expected_demand is not None:
        reasons.append(
            f"Demand forecast: approximately {expected_demand:.0f} units expected "
            f"over the next 30 days."
        )

    if not reasons:
        reasons.append(
            "A possible match based on overall product and buyer profile similarity."
        )

    return reasons
