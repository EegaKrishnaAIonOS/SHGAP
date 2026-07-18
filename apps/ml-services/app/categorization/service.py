import time

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.categorization.embedder import Embedder
from app.categorization.repository import CategoryRecord
from app.categorization.schemas import CategorySuggestion

# Below this cosine similarity, a suggestion is discarded rather than shown.
# Verified empirically against the real model (see ADR-0017): genuine
# same-language matches score ~0.5-0.9, but cross-lingual queries (e.g. a
# Telugu product name against this English-only taxonomy) can score as low
# as ~0.12-0.19 for categories that are plainly wrong. Below this floor the
# score is noise, not a low-confidence-but-real signal — showing it would
# mislead rather than help, so it's better to show nothing and let the SHG
# member pick a category manually.
MINIMUM_SUGGESTION_SCORE = 0.3


def category_corpus_text(category: CategoryRecord) -> str:
    """The text actually embedded for a category — including the parent
    group gives the model more context than the bare category name alone
    (e.g. "Pickles (Food Products)" rather than just "Pickles")."""
    return f"{category.name} ({category.parent_name})" if category.parent_name else category.name


class CategorizationService:
    """Zero-shot categorization via embedding cosine similarity — see
    ADR-0017 for why this isn't a fine-tuned classifier. Category embeddings
    are cached in memory and refreshed on a TTL rather than per-request,
    since the taxonomy changes rarely but categorize calls should be fast.
    """

    def __init__(self, embedder: Embedder, cache_ttl_seconds: int):
        self._embedder = embedder
        self._cache_ttl_seconds = cache_ttl_seconds
        self._categories: list[CategoryRecord] = []
        self._category_embeddings: np.ndarray | None = None
        self._cached_at: float = 0.0

    def _cache_is_stale(self) -> bool:
        if self._category_embeddings is None:
            return True
        return (time.monotonic() - self._cached_at) > self._cache_ttl_seconds

    async def _ensure_category_cache(self, fetch_categories) -> None:
        if not self._cache_is_stale():
            return
        categories = await fetch_categories()
        if not categories:
            self._categories = []
            self._category_embeddings = None
            self._cached_at = time.monotonic()
            return
        texts = [category_corpus_text(c) for c in categories]
        self._categories = categories
        self._category_embeddings = self._embedder.encode_batch(texts)
        self._cached_at = time.monotonic()

    async def suggest(
        self, name: str, description: str | None, fetch_categories, top_k: int = 3
    ) -> list[CategorySuggestion]:
        await self._ensure_category_cache(fetch_categories)
        if not self._categories or self._category_embeddings is None:
            return []

        query_text = f"{name} {description}".strip() if description else name
        query_embedding = self._embedder.encode_batch([query_text])

        similarities = cosine_similarity(query_embedding, self._category_embeddings)[0]
        ranked_indices = np.argsort(similarities)[::-1][:top_k]

        return [
            CategorySuggestion(
                category_id=self._categories[i].id,
                category_name=self._categories[i].name,
                parent_category_name=self._categories[i].parent_name,
                # Cosine similarity on normalized embeddings is already in
                # [-1, 1]; clamp to [0, 1] since a negative "confidence"
                # reads as nonsensical to an API consumer even though it's a
                # mathematically valid (if very poor) similarity score.
                score=max(0.0, min(1.0, float(similarities[i]))),
            )
            for i in ranked_indices
            if similarities[i] >= MINIMUM_SUGGESTION_SCORE
        ]
