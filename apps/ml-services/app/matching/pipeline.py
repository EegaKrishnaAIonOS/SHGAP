import numpy as np

from app.categorization.embedder import Embedder
from app.market_intelligence.repository import fetch_festivals
from app.matching import content_similarity, explanations, ranking, scoring
from app.matching.demand_estimate import estimate_expected_demand
from app.matching.embeddings import (
    compute_and_store_buyer_embeddings,
    compute_and_store_product_embeddings,
)
from app.matching.repository import (
    BuyerRecord,
    ProductRecord,
    fetch_buyers,
    fetch_embeddings,
    fetch_products_for_shg,
)


async def _ensure_product_embeddings(
    embedder: Embedder, products: list[ProductRecord]
) -> dict[str, list[float]]:
    existing = await fetch_embeddings("products", [p.id for p in products])
    missing = [p for p in products if existing[p.id] is None]
    if missing:
        computed = await compute_and_store_product_embeddings(embedder, missing)
        existing.update(computed)
    return existing


async def _ensure_buyer_embeddings(
    embedder: Embedder, buyers: list[BuyerRecord]
) -> dict[str, list[float]]:
    existing = await fetch_embeddings("buyers", [b.id for b in buyers])
    missing = [b for b in buyers if existing[b.id] is None]
    if missing:
        computed = await compute_and_store_buyer_embeddings(embedder, missing)
        existing.update(computed)
    return existing


def _price_band(buyer: BuyerRecord) -> tuple[float | None, float | None]:
    if not buyer.demand_profile:
        return None, None
    return buyer.demand_profile.get("priceBandMin"), buyer.demand_profile.get("priceBandMax")


async def compute_recommendations_for_shg(
    shg_id: str, embedder: Embedder, top_k: int = 10
) -> list[dict]:
    """For each buyer, finds this SHG's single best-matching product and
    returns the top `top_k` buyers ranked by that match — "this buyer is a
    strong fit for you, especially this product" rather than every
    product x buyer combination. Embeddings for anything not yet computed
    are computed and stored lazily here (self-healing on read) rather than
    requiring a separate batch job first — at pilot scale (single-digit
    products/buyers) this is cheap; see ADR-0026."""
    products = await fetch_products_for_shg(shg_id)
    if not products:
        return []
    buyers = await fetch_buyers()
    if not buyers:
        return []
    festivals = await fetch_festivals()

    product_embeddings = await _ensure_product_embeddings(embedder, products)
    buyer_embeddings = await _ensure_buyer_embeddings(embedder, buyers)

    product_vectors = np.array([product_embeddings[p.id] for p in products])
    buyer_vectors = np.array([buyer_embeddings[b.id] for b in buyers])
    similarity_matrix = content_similarity.cosine_similarity_matrix(buyer_vectors, product_vectors)

    demand_cache: dict[str, float | None] = {}
    candidates: list[dict] = []

    for buyer_index, buyer in enumerate(buyers):
        price_min, price_max = _price_band(buyer)
        best_candidate: dict | None = None

        for product_index, product in enumerate(products):
            content_sim = float(similarity_matrix[buyer_index, product_index])
            category_interest = scoring.category_interest_score(
                product.category_id, buyer.category_ids
            )
            price_fit = scoring.price_band_score(product.price, price_min, price_max)
            distance_km = scoring.compute_distance_km(
                buyer.lat, buyer.lng, product.lat, product.lng
            )
            geo = scoring.geo_proximity_score(distance_km)

            components = scoring.MatchComponents(
                content_similarity=content_sim,
                category_interest=category_interest,
                price_band_fit=price_fit,
                geo_proximity=geo,
            )
            components_dict = {
                "content_similarity": content_sim,
                "category_interest": category_interest,
                "price_band_fit": price_fit,
                "geo_proximity": geo,
            }

            ranker_score = ranking.score(components_dict)
            final_score = ranker_score if ranker_score is not None else components.weighted_score()

            if best_candidate is None or final_score > best_candidate["match_score"]:
                if product.id not in demand_cache:
                    demand_cache[product.id] = estimate_expected_demand(product.id, festivals)
                expected_demand = demand_cache[product.id]

                reasons = explanations.generate_template_reasons(
                    components, product, buyer, distance_km, expected_demand
                )
                best_candidate = {
                    "buyer_id": buyer.id,
                    "product_id": product.id,
                    "match_score": round(final_score, 4),
                    "expected_demand": expected_demand,
                    "reasons": reasons,
                    "components": components_dict,
                }

        if best_candidate:
            candidates.append(best_candidate)

    candidates.sort(key=lambda c: c["match_score"], reverse=True)
    return candidates[:top_k]
