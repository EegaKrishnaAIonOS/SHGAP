-- CreateTable
CREATE TABLE "scheme_chunks" (
    "id" UUID NOT NULL,
    "scheme_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(384),

    CONSTRAINT "scheme_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheme_chunks_scheme_name_idx" ON "scheme_chunks"("scheme_name");

-- Deliberately NO vector index here, unlike products/buyers' ivfflat indexes.
-- Verified empirically: an ivfflat index (even with a low `lists` value) is
-- an approximate-nearest-neighbour structure that partitions rows into
-- clusters and by default probes only one of them per query — with a table
-- this small (a few dozen curated scheme chunks, never expected to scale to
-- products/buyers' volumes), many query vectors' nearest cluster ends up
-- holding zero of the actual rows, so the query silently returns NO matches
-- even when a clearly relevant chunk exists. A plain sequential scan over a
-- table this size costs microseconds and always finds the true nearest
-- neighbours — reintroduce an index only if this table's row count grows
-- enough to matter (see ADR-0021).
