from fastapi.testclient import TestClient

from app.main import app
from app.scheme_guidance.repository import SchemeChunkResult
from app.scheme_guidance.router import get_scheme_guidance_service, get_search_chunks_fn
from app.scheme_guidance.service import SchemeGuidanceService
from tests.categorization.fake_embedder import FakeEmbedder

CHUNKS = [
    SchemeChunkResult(
        scheme_name="PM SVANidhi",
        content="PM SVANidhi provides working capital loans to street vendors.",
        source_url="https://pmsvanidhi.mohua.gov.in/",
        source_title="PM SVANidhi",
        score=0.85,
    ),
]


async def fake_search_chunks(query_embedding, top_k):
    return CHUNKS


def override_service():
    return SchemeGuidanceService(embedder=FakeEmbedder())


app.dependency_overrides[get_scheme_guidance_service] = override_service
app.dependency_overrides[get_search_chunks_fn] = lambda: fake_search_chunks

client = TestClient(app)


def test_search_returns_ranked_results_with_citations():
    response = client.post("/scheme-guidance/search", json={"query": "street vendor loan"})
    assert response.status_code == 200

    body = response.json()
    assert len(body["results"]) == 1
    assert body["results"][0]["scheme_name"] == "PM SVANidhi"
    assert body["results"][0]["source_url"] == "https://pmsvanidhi.mohua.gov.in/"


def test_search_rejects_empty_query():
    response = client.post("/scheme-guidance/search", json={"query": ""})
    assert response.status_code == 422


def test_search_rejects_top_k_out_of_range():
    response = client.post("/scheme-guidance/search", json={"query": "loan", "top_k": 20})
    assert response.status_code == 422
