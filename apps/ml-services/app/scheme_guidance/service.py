from typing import Awaitable, Callable

from app.categorization.embedder import Embedder
from app.scheme_guidance.repository import SchemeChunkResult
from app.scheme_guidance.schemas import SchemeSearchResult

# Below this cosine similarity, a retrieved chunk is discarded rather than
# handed to the LLM to answer from — same rationale and same floor as
# `categorization/service.py`'s MINIMUM_SUGGESTION_SCORE (verified empirically
# there against this same embedding model): a genuinely off-topic question
# (e.g. "what's the weather today") would otherwise still retrieve the
# closest-scoring scheme chunk and risk the LLM treating it as relevant
# grounding rather than recognizing the question is out of scope.
MINIMUM_RELEVANCE_SCORE = 0.3

SearchChunksFn = Callable[..., Awaitable[list[SchemeChunkResult]]]


class SchemeGuidanceService:
    """Embeds a scheme-guidance query and ranks pre-embedded scheme chunks by
    cosine similarity — the retrieval half of T12's RAG split (ADR-0021);
    grounding the LLM answer on the returned chunks happens in voice-service,
    not here, so this service has no LLM dependency of its own."""

    def __init__(self, embedder: Embedder):
        self._embedder = embedder

    async def search(
        self, query: str, search_chunks_fn: SearchChunksFn, top_k: int = 3
    ) -> list[SchemeSearchResult]:
        query_embedding = self._embedder.encode_batch([query])[0]
        chunks = await search_chunks_fn(query_embedding, top_k)

        return [
            SchemeSearchResult(
                scheme_name=chunk.scheme_name,
                content=chunk.content,
                source_url=chunk.source_url,
                source_title=chunk.source_title,
                score=chunk.score,
            )
            for chunk in chunks
            if chunk.score >= MINIMUM_RELEVANCE_SCORE
        ]
