from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

import numpy as np

from app.matching.pipeline import compute_recommendations_for_shg
from app.matching.repository import BuyerRecord, ProductRecord

PRODUCT_A = ProductRecord(
    id="prod-a",
    shg_id="shg-1",
    category_id="cat-pickles",
    category_name="Pickles",
    district_id="dist-1",
    name="Mango Pickle",
    description="Andhra-style",
    price=150.0,
    moq=5,
    stock=100,
    is_available=True,
    lng=77.6,
    lat=14.68,
)
PRODUCT_B = ProductRecord(
    id="prod-b",
    shg_id="shg-1",
    category_id="cat-bamboo",
    category_name="Bamboo Craft",
    district_id="dist-1",
    name="Bamboo Basket",
    description="Handwoven",
    price=250.0,
    moq=3,
    stock=50,
    is_available=True,
    lng=77.6,
    lat=14.68,
)
BUYER_PICKLES = BuyerRecord(
    id="buyer-pickles",
    name="Pickle Lover Mart",
    type="RETAIL",
    organization=None,
    district_id="dist-1",
    demand_profile={"priceBandMin": 100, "priceBandMax": 300},
    category_ids=["cat-pickles"],
    category_names=["Pickles"],
    lng=77.6,
    lat=14.68,
)
BUYER_BAMBOO = BuyerRecord(
    id="buyer-bamboo",
    name="Bamboo Emporium",
    type="INSTITUTIONAL",
    organization=None,
    district_id="dist-1",
    demand_profile={"priceBandMin": 200, "priceBandMax": 400},
    category_ids=["cat-bamboo"],
    category_names=["Bamboo Craft"],
    lng=77.6,
    lat=14.68,
)


class FakeEmbedder:
    """A fake embedder that gives each distinct text its own one-hot-ish
    direction, so cosine similarity meaningfully distinguishes matching vs
    non-matching category text rather than returning arbitrary numbers."""

    def encode_batch(self, texts: list[str]) -> np.ndarray:
        vectors = []
        for text in texts:
            if "Pickles" in text:
                vectors.append([1.0, 0.0])
            elif "Bamboo" in text:
                vectors.append([0.0, 1.0])
            else:
                vectors.append([0.5, 0.5])
        return np.array(vectors)


async def _run_with_common_patches(products, buyers, top_k=10, ranker_score=None):
    with ExitStack() as stack:
        stack.enter_context(
            patch(
                "app.matching.pipeline.fetch_products_for_shg",
                new=AsyncMock(return_value=products),
            )
        )
        stack.enter_context(
            patch("app.matching.pipeline.fetch_buyers", new=AsyncMock(return_value=buyers))
        )
        stack.enter_context(
            patch("app.matching.pipeline.fetch_festivals", new=AsyncMock(return_value=[]))
        )
        all_ids = [p.id for p in products] + [b.id for b in buyers]
        stack.enter_context(
            patch(
                "app.matching.pipeline.fetch_embeddings",
                new=AsyncMock(return_value=dict.fromkeys(all_ids)),
            )
        )
        stack.enter_context(
            patch(
                "app.matching.pipeline.compute_and_store_product_embeddings",
                new=AsyncMock(
                    side_effect=lambda embedder, products: {
                        p.id: embedder.encode_batch([p.name])[0].tolist() for p in products
                    }
                ),
            )
        )
        stack.enter_context(
            patch(
                "app.matching.pipeline.compute_and_store_buyer_embeddings",
                new=AsyncMock(
                    side_effect=lambda embedder, buyers: {
                        b.id: embedder.encode_batch(
                            [b.name + " " + " ".join(b.category_names)]
                        )[0].tolist()
                        for b in buyers
                    }
                ),
            )
        )
        stack.enter_context(
            patch("app.matching.pipeline.estimate_expected_demand", return_value=None)
        )
        stack.enter_context(patch("app.matching.ranking.score", return_value=ranker_score))

        return await compute_recommendations_for_shg("shg-1", FakeEmbedder(), top_k=top_k)


async def test_returns_empty_list_when_shg_has_no_products():
    with patch("app.matching.pipeline.fetch_products_for_shg", new=AsyncMock(return_value=[])):
        result = await compute_recommendations_for_shg("shg-1", FakeEmbedder())
    assert result == []


async def test_returns_empty_list_when_there_are_no_buyers():
    with (
        patch(
            "app.matching.pipeline.fetch_products_for_shg",
            new=AsyncMock(return_value=[PRODUCT_A]),
        ),
        patch("app.matching.pipeline.fetch_buyers", new=AsyncMock(return_value=[])),
    ):
        result = await compute_recommendations_for_shg("shg-1", FakeEmbedder())
    assert result == []


async def test_picks_the_best_matching_product_per_buyer():
    results = await _run_with_common_patches([PRODUCT_A, PRODUCT_B], [BUYER_PICKLES, BUYER_BAMBOO])

    by_buyer = {r["buyer_id"]: r for r in results}
    assert by_buyer["buyer-pickles"]["product_id"] == "prod-a"
    assert by_buyer["buyer-bamboo"]["product_id"] == "prod-b"


async def test_results_are_sorted_by_match_score_descending():
    results = await _run_with_common_patches([PRODUCT_A, PRODUCT_B], [BUYER_PICKLES, BUYER_BAMBOO])

    scores = [r["match_score"] for r in results]
    assert scores == sorted(scores, reverse=True)


async def test_top_k_limits_the_number_of_returned_candidates():
    results = await _run_with_common_patches(
        [PRODUCT_A, PRODUCT_B], [BUYER_PICKLES, BUYER_BAMBOO], top_k=1
    )

    assert len(results) == 1


async def test_uses_the_trained_ranker_score_when_available():
    results = await _run_with_common_patches(
        [PRODUCT_A, PRODUCT_B], [BUYER_PICKLES, BUYER_BAMBOO], ranker_score=0.999
    )

    assert all(r["match_score"] == 0.999 for r in results)
