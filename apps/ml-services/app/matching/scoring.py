import math
from dataclasses import dataclass

EARTH_RADIUS_KM = 6371.0
# Beyond this, geo proximity contributes nothing — a government-procurement
# buyer with no stated district is state-level and shouldn't be geo-penalized
# at all (handled separately, see `geo_proximity_score`), but a retail buyer
# 300km from a product is realistically not going to place a real order.
MAX_RELEVANT_DISTANCE_KM = 150.0


@dataclass(frozen=True)
class MatchComponents:
    """The real, individually-inspectable sub-scores behind a match — this
    is also the basis for the template explanations in explanations.py:
    each component here is a genuine, computed number, not a black box."""

    content_similarity: float
    category_interest: float
    price_band_fit: float
    geo_proximity: float | None  # None when either side has no location at all

    def weighted_score(self) -> float:
        # No trained ranker exists yet (LightGBM is gated behind real
        # accept/reject feedback — see ranking.py); these weights are a
        # reasoned starting point, not learned. content_similarity gets the
        # largest weight since it's the only signal that's always available
        # and always real (an embedding always exists); geo is weighted
        # lightly since a GOVERNMENT_PROCUREMENT buyer often has no district
        # at all (state-level) and shouldn't be penalized for that.
        geo = self.geo_proximity if self.geo_proximity is not None else 0.5
        return (
            0.45 * self.content_similarity
            + 0.30 * self.category_interest
            + 0.15 * self.price_band_fit
            + 0.10 * geo
        )


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def category_interest_score(product_category_id: str, buyer_category_ids: list[str]) -> float:
    """1.0 if the buyer explicitly declared interest in this exact category,
    else 0.0 — a real, binary, declared signal (BuyerCategoryInterest), not
    an inferred one. A buyer with no declared interests at all (e.g. one
    that hasn't been categorized yet) scores 0.0 here for every product,
    which is honest — it says nothing, so it shouldn't score as a match."""
    return 1.0 if product_category_id in buyer_category_ids else 0.0


def price_band_score(
    price: float, price_band_min: float | None, price_band_max: float | None
) -> float:
    """1.0 inside the buyer's stated price band, tapering linearly to 0.0 at
    twice the band's width outside either edge. No stated band at all means
    the buyer hasn't told us anything about price preference — neutral
    (0.5), not a penalty."""
    if price_band_min is None and price_band_max is None:
        return 0.5
    lo = price_band_min if price_band_min is not None else 0.0
    hi = price_band_max if price_band_max is not None else lo * 3 if lo > 0 else price * 3
    if lo <= price <= hi:
        return 1.0

    band_width = max(hi - lo, 1.0)
    taper_distance = 2 * band_width
    overshoot = lo - price if price < lo else price - hi
    return max(0.0, 1.0 - overshoot / taper_distance)


def geo_proximity_score(distance_km: float | None) -> float | None:
    """`None` (not 0.0) when a real distance couldn't be computed at all
    (missing location on either side) — the caller treats that as "unknown,
    don't penalize" rather than "confirmed far away"."""
    if distance_km is None:
        return None
    return max(0.0, 1.0 - distance_km / MAX_RELEVANT_DISTANCE_KM)


def compute_distance_km(
    buyer_lat: float | None,
    buyer_lng: float | None,
    product_lat: float | None,
    product_lng: float | None,
) -> float | None:
    if None in (buyer_lat, buyer_lng, product_lat, product_lng):
        return None
    return haversine_km(buyer_lat, buyer_lng, product_lat, product_lng)
