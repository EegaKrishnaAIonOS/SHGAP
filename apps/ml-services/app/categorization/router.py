from typing import Callable, Coroutine

from fastapi import APIRouter, Depends

from app.categorization.embedder import SentenceTransformerEmbedder
from app.categorization.repository import CategoryRecord, fetch_categories
from app.categorization.schemas import CategorizeRequest, CategorizeResponse
from app.categorization.service import CategorizationService
from app.config import settings

router = APIRouter(tags=["categorization"])

# Module-level singleton: the embedding model (and the category-embedding
# cache it backs) is expensive enough to load/compute that it must survive
# across requests, not be rebuilt per-call.
_service = CategorizationService(
    embedder=SentenceTransformerEmbedder(settings.embedding_model_name),
    cache_ttl_seconds=settings.category_cache_ttl_seconds,
)


def get_categorization_service() -> CategorizationService:
    return _service


def get_fetch_categories() -> Callable[[], Coroutine[None, None, list[CategoryRecord]]]:
    return fetch_categories


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize(
    request: CategorizeRequest,
    service: CategorizationService = Depends(get_categorization_service),
    fetch_categories_fn=Depends(get_fetch_categories),
) -> CategorizeResponse:
    suggestions = await service.suggest(request.name, request.description, fetch_categories_fn)
    return CategorizeResponse(suggestions=suggestions)
