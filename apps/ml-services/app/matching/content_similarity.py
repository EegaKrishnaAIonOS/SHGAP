import numpy as np


def cosine_similarity_matrix(buyer_vectors: np.ndarray, product_vectors: np.ndarray) -> np.ndarray:
    """Returns a (n_buyers, n_products) matrix of cosine similarities.
    Embeddings from `SentenceTransformerEmbedder` are already L2-normalized
    (`normalize_embeddings=True`), so cosine similarity reduces to a plain
    dot product — no need to re-normalize here."""
    if buyer_vectors.size == 0 or product_vectors.size == 0:
        return np.zeros((buyer_vectors.shape[0], product_vectors.shape[0]))
    similarities = buyer_vectors @ product_vectors.T
    # Normalized-embedding cosine similarity is mathematically in [-1, 1];
    # clamp into [0, 1] since a negative "content match" reads as nonsensical
    # to an API consumer even though it's a valid (very poor) similarity.
    return np.clip(similarities, 0.0, 1.0)
