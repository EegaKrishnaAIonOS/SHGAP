from typing import Protocol

import numpy as np


class Embedder(Protocol):
    """Anything that turns a batch of strings into a batch of embedding
    vectors. `CategorizationService` depends on this, not on
    `SentenceTransformer` directly, so tests can substitute a fast fake
    embedder instead of loading the real ~470MB model."""

    def encode_batch(self, texts: list[str]) -> np.ndarray: ...


class SentenceTransformerEmbedder:
    """Lazily loads the configured sentence-transformers model on first use —
    keeps `import`ing this module (e.g. at FastAPI startup, or in a test that
    never calls it) cheap, and the actual multi-second model load only pays
    off if categorization is ever actually requested."""

    def __init__(self, model_name: str):
        self._model_name = model_name
        self._model = None

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self._model_name)
        return self._model

    def encode_batch(self, texts: list[str]) -> np.ndarray:
        return self._get_model().encode(texts, convert_to_numpy=True, normalize_embeddings=True)
