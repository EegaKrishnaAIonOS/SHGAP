import numpy as np
import pytest

from app.matching.content_similarity import cosine_similarity_matrix


class TestCosineSimilarityMatrix:
    def test_identical_normalized_vectors_score_one(self):
        vec = np.array([[1.0, 0.0]])
        result = cosine_similarity_matrix(vec, vec)
        assert result[0, 0] == pytest.approx(1.0)

    def test_orthogonal_vectors_score_zero(self):
        buyer = np.array([[1.0, 0.0]])
        product = np.array([[0.0, 1.0]])
        result = cosine_similarity_matrix(buyer, product)
        assert result[0, 0] == pytest.approx(0.0)

    def test_opposite_vectors_are_clamped_to_zero_not_negative(self):
        buyer = np.array([[1.0, 0.0]])
        product = np.array([[-1.0, 0.0]])
        result = cosine_similarity_matrix(buyer, product)
        assert result[0, 0] == 0.0

    def test_shape_is_buyers_by_products(self):
        buyers = np.random.rand(3, 8)
        products = np.random.rand(5, 8)
        result = cosine_similarity_matrix(buyers, products)
        assert result.shape == (3, 5)

    def test_empty_products_returns_zero_matrix_of_correct_shape(self):
        buyers = np.random.rand(2, 8)
        products = np.empty((0, 8))
        result = cosine_similarity_matrix(buyers, products)
        assert result.shape == (2, 0)
