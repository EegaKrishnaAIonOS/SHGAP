from fastapi import APIRouter, Depends

from app.categorization.embedder import SentenceTransformerEmbedder
from app.config import settings
from app.scheme_guidance.repository import search_similar_chunks
from app.scheme_guidance.schemas import SchemeSearchRequest, SchemeSearchResponse
from app.scheme_guidance.service import SchemeGuidanceService

router = APIRouter(tags=["scheme-guidance"])

# Module-level singleton, same rationale as categorization/router.py: the
# embedding model is expensive enough to load that it must survive across
# requests. Sharing `settings.embedding_model_name` with categorization means
# the model is only ever loaded once per process even though both routers
# reference it.
_service = SchemeGuidanceService(
    embedder=SentenceTransformerEmbedder(settings.embedding_model_name)
)


def get_scheme_guidance_service() -> SchemeGuidanceService:
    return _service


def get_search_chunks_fn():
    return search_similar_chunks


@router.post("/scheme-guidance/search", response_model=SchemeSearchResponse)
async def search_schemes(
    request: SchemeSearchRequest,
    service: SchemeGuidanceService = Depends(get_scheme_guidance_service),
    search_chunks_fn=Depends(get_search_chunks_fn),
) -> SchemeSearchResponse:
    results = await service.search(request.query, search_chunks_fn, top_k=request.top_k)
    return SchemeSearchResponse(results=results)
