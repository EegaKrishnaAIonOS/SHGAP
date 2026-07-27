from unittest.mock import AsyncMock, patch

import numpy as np

from app.matching.embeddings import (
    buyer_corpus_text,
    compute_and_store_buyer_embeddings,
    compute_and_store_product_embeddings,
    product_corpus_text,
)
from app.matching.repository import BuyerRecord, ProductRecord


def _product(**overrides) -> ProductRecord:
    defaults = dict(
        id="p1",
        shg_id="shg-1",
        category_id="cat-1",
        category_name="Pickles",
        district_id="dist-1",
        name="Mango Pickle",
        description="Traditional Andhra-style pickle",
        price=150.0,
        moq=5,
        stock=100,
        is_available=True,
        lng=77.6,
        lat=14.68,
    )
    defaults.update(overrides)
    return ProductRecord(**defaults)


def _buyer(**overrides) -> BuyerRecord:
    defaults = dict(
        id="b1",
        name="Vijayawada Retail Mart",
        type="RETAIL",
        organization=None,
        district_id="dist-2",
        demand_profile=None,
        category_ids=["cat-1"],
        category_names=["Pickles"],
        lng=80.6,
        lat=16.5,
    )
    defaults.update(overrides)
    return BuyerRecord(**defaults)


class FakeEmbedder:
    def encode_batch(self, texts: list[str]) -> np.ndarray:
        return np.array([[float(len(t)), 0.0] for t in texts])


class TestCorpusText:
    def test_product_corpus_includes_category_and_description(self):
        text = product_corpus_text(_product())
        assert "Mango Pickle" in text
        assert "Pickles" in text
        assert "Andhra-style" in text

    def test_product_corpus_omits_description_when_absent(self):
        text = product_corpus_text(_product(description=None))
        assert "Mango Pickle" in text
        assert ":" not in text

    def test_buyer_corpus_includes_type_and_category_interests(self):
        text = buyer_corpus_text(_buyer())
        assert "Retail" in text
        assert "Pickles" in text

    def test_buyer_corpus_includes_organization_when_present(self):
        text = buyer_corpus_text(_buyer(organization="ABC Traders"))
        assert "ABC Traders" in text


class TestComputeAndStoreEmbeddings:
    async def test_product_embeddings_are_written_and_returned(self):
        with patch(
            "app.matching.repository.write_embeddings", new=AsyncMock()
        ) as mock_write:
            result = await compute_and_store_product_embeddings(FakeEmbedder(), [_product()])

        assert "p1" in result
        mock_write.assert_awaited_once()
        args, _ = mock_write.call_args
        assert args[0] == "products"

    async def test_buyer_embeddings_are_written_and_returned(self):
        with patch(
            "app.matching.repository.write_embeddings", new=AsyncMock()
        ) as mock_write:
            result = await compute_and_store_buyer_embeddings(FakeEmbedder(), [_buyer()])

        assert "b1" in result
        mock_write.assert_awaited_once()
        args, _ = mock_write.call_args
        assert args[0] == "buyers"

    async def test_empty_input_returns_empty_dict_without_writing(self):
        with patch("app.matching.repository.write_embeddings", new=AsyncMock()) as mock_write:
            result = await compute_and_store_product_embeddings(FakeEmbedder(), [])

        assert result == {}
        mock_write.assert_not_awaited()
