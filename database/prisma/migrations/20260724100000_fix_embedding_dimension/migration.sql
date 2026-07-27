-- Fix Product.embedding and Buyer.embedding dimension: 768 was a placeholder
-- anticipating a separate, never-built embedding model (T02); T17 reuses the
-- 384-dim sentence-transformer model already running in ml-services for
-- categorization/scheme-guidance instead (see SchemeChunk.embedding), so both
-- columns are corrected to vector(384) to match reality. Both columns are
-- all-NULL in every real environment today, so this is a safe type change
-- with no data to migrate — see ADR-0026.
--
-- Prisma's schema diff cannot see indexes on `Unsupported` columns (the same
-- limitation noted in the 20260723100000_add_gem_opportunities migration),
-- so the ivfflat indexes below are dropped/recreated by hand rather than
-- via a generated diff.

DROP INDEX "products_embedding_ivfflat_idx";
DROP INDEX "buyers_embedding_ivfflat_idx";

ALTER TABLE "products" ALTER COLUMN "embedding" TYPE vector(384);
ALTER TABLE "buyers" ALTER COLUMN "embedding" TYPE vector(384);

CREATE INDEX "products_embedding_ivfflat_idx" ON "products" USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
CREATE INDEX "buyers_embedding_ivfflat_idx" ON "buyers" USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
