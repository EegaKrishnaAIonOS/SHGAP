from fastapi.testclient import TestClient

from app.categorization.router import get_categorization_service, get_fetch_categories
from app.categorization.service import CategorizationService
from app.main import app
from tests.categorization.fake_embedder import FakeEmbedder
from tests.categorization.helpers import make_category

CATEGORIES = [
    make_category("cat-pickles", "Pickles", "pickles", "p1", "Food Products"),
    make_category("cat-bamboo", "Bamboo Craft", "bamboo-craft", "p2", "Handicrafts"),
]


async def fake_fetch_categories():
    return CATEGORIES


def override_service():
    return CategorizationService(embedder=FakeEmbedder(), cache_ttl_seconds=300)


app.dependency_overrides[get_categorization_service] = override_service
app.dependency_overrides[get_fetch_categories] = lambda: fake_fetch_categories

client = TestClient(app)


def test_categorize_returns_ranked_suggestions():
    response = client.post(
        "/categorize", json={"name": "Bamboo basket", "description": "Handwoven bamboo craft"}
    )
    assert response.status_code == 200

    body = response.json()
    # FakeEmbedder's crude bag-of-words hashing gives the unrelated category
    # a similarity of exactly 0.0, well below MINIMUM_SUGGESTION_SCORE — it's
    # correctly dropped rather than shown as a low-confidence suggestion.
    assert len(body["suggestions"]) == 1
    assert body["suggestions"][0]["category_id"] == "cat-bamboo"
    assert body["suggestions"][0]["parent_category_name"] == "Handicrafts"


def test_categorize_without_description_still_works():
    response = client.post("/categorize", json={"name": "Pickles jar"})
    assert response.status_code == 200
    assert len(response.json()["suggestions"]) == 1


def test_categorize_rejects_empty_name():
    response = client.post("/categorize", json={"name": ""})
    assert response.status_code == 422
