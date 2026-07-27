from app.categorization.embedder import Embedder
from app.matching.repository import BuyerRecord, ProductRecord


def product_corpus_text(product: ProductRecord) -> str:
    """Mirrors categorization's `category_corpus_text` — includes the
    category for context, plus the description when present, since a bare
    product name ("Mango Pickle") gives the embedding model much less to
    work with than "Mango Pickle (Pickles): Traditional Andhra-style..."."""
    base = f"{product.name} ({product.category_name})"
    return f"{base}: {product.description}" if product.description else base


def buyer_corpus_text(buyer: BuyerRecord) -> str:
    """A buyer has no free-text description — its "content" is what it says
    it's interested in (declared category interests) plus its type/org,
    which is exactly the signal a content-similarity match should use."""
    parts = [buyer.name, buyer.type.replace("_", " ").title()]
    if buyer.organization:
        parts.append(buyer.organization)
    if buyer.category_names:
        parts.append("Interested in: " + ", ".join(buyer.category_names))
    return ". ".join(parts)


async def compute_and_store_product_embeddings(
    embedder: Embedder, products: list[ProductRecord]
) -> dict[str, list[float]]:
    from app.matching.repository import write_embeddings

    if not products:
        return {}
    texts = [product_corpus_text(p) for p in products]
    vectors = embedder.encode_batch(texts)
    embeddings = {p.id: vectors[i].tolist() for i, p in enumerate(products)}
    await write_embeddings("products", embeddings)
    return embeddings


async def compute_and_store_buyer_embeddings(
    embedder: Embedder, buyers: list[BuyerRecord]
) -> dict[str, list[float]]:
    from app.matching.repository import write_embeddings

    if not buyers:
        return {}
    texts = [buyer_corpus_text(b) for b in buyers]
    vectors = embedder.encode_batch(texts)
    embeddings = {b.id: vectors[i].tolist() for i, b in enumerate(buyers)}
    await write_embeddings("buyers", embeddings)
    return embeddings
