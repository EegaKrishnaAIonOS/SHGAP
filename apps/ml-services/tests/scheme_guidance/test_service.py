import numpy as np
import pytest

from app.scheme_guidance.repository import SchemeChunkResult
from app.scheme_guidance.service import SchemeGuidanceService
from tests.categorization.fake_embedder import FakeEmbedder

CHUNKS = [
    SchemeChunkResult(
        scheme_name="PM SVANidhi",
        content="PM SVANidhi provides working capital loans to street vendors.",
        source_url="https://pmsvanidhi.mohua.gov.in/",
        source_title="PM SVANidhi",
        score=0.91,
    ),
    SchemeChunkResult(
        scheme_name="SthreeNidhi",
        content="SthreeNidhi disburses SHG credit within 48 hours.",
        source_url="https://www.sthreenidhi.ap.gov.in/",
        source_title="SthreeNidhi",
        score=0.12,
    ),
]


def make_service() -> SchemeGuidanceService:
    return SchemeGuidanceService(embedder=FakeEmbedder())


class TestSearch:
    @pytest.mark.asyncio
    async def test_drops_results_below_the_relevance_floor(self):
        service = make_service()

        async def fake_search_chunks(query_embedding, top_k):
            assert isinstance(query_embedding, np.ndarray)
            return CHUNKS

        results = await service.search("PM SVANidhi loan amount", fake_search_chunks)

        assert len(results) == 1
        assert results[0].scheme_name == "PM SVANidhi"

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_nothing_clears_the_floor(self):
        service = make_service()

        async def fake_search_chunks(query_embedding, top_k):
            return [CHUNKS[1]]

        results = await service.search("unrelated question", fake_search_chunks)

        assert results == []

    @pytest.mark.asyncio
    async def test_passes_top_k_through_to_the_search_function(self):
        service = make_service()
        received_top_k = None

        async def fake_search_chunks(query_embedding, top_k):
            nonlocal received_top_k
            received_top_k = top_k
            return []

        await service.search("query", fake_search_chunks, top_k=5)

        assert received_top_k == 5
