import re

import numpy as np

VOCAB_SIZE = 4096  # large enough that hash collisions between unrelated words are rare


class FakeEmbedder:
    """Deterministic bag-of-words hashing "embedder" for tests — no model
    download, no network, no GPU/CPU inference cost, but still produces
    embeddings where texts sharing words score more similar than texts that
    don't, which is all `CategorizationService`'s ranking logic actually
    depends on."""

    def encode_batch(self, texts: list[str]) -> np.ndarray:
        return np.array([self._encode_one(t) for t in texts])

    @staticmethod
    def _encode_one(text: str) -> np.ndarray:
        vector = np.zeros(VOCAB_SIZE, dtype=np.float64)
        for word in re.findall(r"\w+", text.lower()):
            vector[hash(word) % VOCAB_SIZE] += 1.0
        norm = np.linalg.norm(vector)
        return vector / norm if norm > 0 else vector
