from fastapi import APIRouter, Query

from app.categorization.embedder import SentenceTransformerEmbedder
from app.config import settings
from app.matching import embeddings as embeddings_module
from app.matching import pipeline, ranking
from app.matching.repository import fetch_buyers, fetch_products, fetch_recommendation_feedback

router = APIRouter(prefix="/matching", tags=["matching"])

# Module-level singleton, same reasoning as categorization's: the embedding
# model is expensive to load and should survive across requests.
_embedder = SentenceTransformerEmbedder(settings.embedding_model_name)


@router.get("/candidates")
async def candidates(shg_id: str, top_k: int = Query(default=10, ge=1, le=50)) -> dict:
    """Computes ranked buyer recommendation candidates for one SHG — the
    seam core-api's `GET /recommendations/:shgId` calls to get real
    match scores/explanations before persisting them as `Recommendation`
    rows. Purely computational: nothing is written to `recommendations`
    here (core-api owns that table)."""
    results = await pipeline.compute_recommendations_for_shg(shg_id, _embedder, top_k)
    return {"shg_id": shg_id, "candidates": results}


@router.post("/refresh-embeddings")
async def refresh_embeddings() -> dict:
    """Force-recomputes embeddings for every product and buyer, regardless
    of whether one already exists — useful after changing the embedding
    model/corpus text. Day-to-day, `pipeline.compute_recommendations_for_shg`
    already computes embeddings lazily for anything missing."""
    products = await fetch_products()
    buyers = await fetch_buyers()
    product_embeddings = await embeddings_module.compute_and_store_product_embeddings(
        _embedder, products
    )
    buyer_embeddings = await embeddings_module.compute_and_store_buyer_embeddings(
        _embedder, buyers
    )
    return {
        "products_embedded": len(product_embeddings),
        "buyers_embedded": len(buyer_embeddings),
    }


@router.post("/train-ranker")
async def train_ranker() -> dict:
    """On-demand trigger for training the LightGBM re-ranker on real
    accept/reject feedback accumulated in `recommendations` — declines
    (returns `trained: false`) below `settings.min_feedback_rows_for_ranker`
    rather than fitting to noise. See ADR-0026."""
    feedback = await fetch_recommendation_feedback()
    entry = ranking.train(feedback)
    return {"trained": entry is not None, "feedback_rows": len(feedback), "result": entry}
