import pytest

from app.categorization.repository import CategoryRecord
from app.categorization.service import CategorizationService, category_corpus_text
from tests.categorization.fake_embedder import FakeEmbedder
from tests.categorization.helpers import make_category

CATEGORIES = [
    make_category("cat-pickles", "Pickles", "pickles", "p1", "Food Products"),
    make_category("cat-bamboo", "Bamboo Craft", "bamboo-craft", "p2", "Handicrafts"),
    make_category("cat-saree", "Cotton Sarees", "cotton-sarees", "p3", "Handloom"),
]


async def fetch_fixed_categories():
    return CATEGORIES


def make_service(cache_ttl_seconds: int = 300) -> CategorizationService:
    return CategorizationService(embedder=FakeEmbedder(), cache_ttl_seconds=cache_ttl_seconds)


class TestCategoryCorpusText:
    def test_includes_parent_name_when_present(self):
        assert category_corpus_text(CATEGORIES[0]) == "Pickles (Food Products)"

    def test_falls_back_to_bare_name_without_a_parent(self):
        top_level = CategoryRecord(
            id="p1", name="Food Products", slug="food-products", parent_id=None, parent_name=None
        )
        assert category_corpus_text(top_level) == "Food Products"


class TestSuggest:
    @pytest.mark.asyncio
    async def test_ranks_the_word_overlapping_category_highest(self):
        # FakeEmbedder does exact-token bag-of-words matching (no stemming) —
        # "Pickles" here matches the "Pickles" category name verbatim; this
        # test is only exercising CategorizationService's ranking/sorting,
        # not any real model's linguistic robustness.
        service = make_service()
        suggestions = await service.suggest(
            "Mango Pickles jar", "Spicy pickles in oil", fetch_fixed_categories, top_k=3
        )

        # FakeEmbedder's bag-of-words hashing gives the other two categories
        # a similarity of 0.0 (no shared words) — below MINIMUM_SUGGESTION_SCORE,
        # so only the genuinely overlapping category survives.
        assert len(suggestions) == 1
        assert suggestions[0].category_id == "cat-pickles"

    @pytest.mark.asyncio
    async def test_respects_top_k(self):
        service = make_service()
        suggestions = await service.suggest("Bamboo basket", None, fetch_fixed_categories, top_k=1)
        assert len(suggestions) == 1
        assert suggestions[0].category_id == "cat-bamboo"

    @pytest.mark.asyncio
    async def test_every_score_is_clamped_to_0_1(self):
        service = make_service()
        suggestions = await service.suggest("Handwoven cotton saree", None, fetch_fixed_categories)
        assert all(0.0 <= s.score <= 1.0 for s in suggestions)

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_categories_exist(self):
        service = make_service()

        async def fetch_none():
            return []

        suggestions = await service.suggest("Anything", None, fetch_none)
        assert suggestions == []

    @pytest.mark.asyncio
    async def test_caches_category_embeddings_across_calls(self):
        service = make_service(cache_ttl_seconds=300)
        call_count = 0

        async def counting_fetch():
            nonlocal call_count
            call_count += 1
            return CATEGORIES

        await service.suggest("Pickle", None, counting_fetch)
        await service.suggest("Saree", None, counting_fetch)

        assert call_count == 1

    @pytest.mark.asyncio
    async def test_refreshes_category_cache_once_ttl_expires(self):
        service = make_service(cache_ttl_seconds=0)
        call_count = 0

        async def counting_fetch():
            nonlocal call_count
            call_count += 1
            return CATEGORIES

        await service.suggest("Pickle", None, counting_fetch)
        await service.suggest("Saree", None, counting_fetch)

        assert call_count == 2
