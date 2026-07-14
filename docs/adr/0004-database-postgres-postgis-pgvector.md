# ADR-0004: Single PostgreSQL 16 engine with PostGIS + pgvector

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The platform needs relational data (users, SHGs, products, buyers, sales), geo data (SHG/product/buyer locations, geo-queries, heatmaps) and vector data (product/buyer embeddings for recommendation) simultaneously, within a 90-day POC that must also be simple to operate and secure under DPDP Act 2023.

## Decision
Use PostgreSQL 16 as the single system of record, with the PostGIS extension for geo columns/queries and pgvector for embeddings — one database engine instead of three separate stores.

## Alternatives Considered
- **Separate stores** (Postgres + a geo DB + a dedicated vector DB like Pinecone/Milvus) — each store optimized for its workload, but triples operational surface (backups, encryption, access control, DPDP audit) for a pilot of this size.
- **MongoDB** for flexible product-catalogue documents — weaker transactional/relational guarantees for registry+RBAC data, and no first-class geo/vector story as strong as Postgres's.
- **FAISS as the sole vector index** — faster at large scale, but pgvector is sufficient at pilot data volumes and avoids syncing a second embedding store; FAISS is kept as an option if pgvector recall/latency becomes a bottleneck (T17).

## Consequences
- Positive: one engine to secure, encrypt (pgcrypto/KMS), back up and audit for DPDP compliance (T22); joins across relational + geo + vector data in a single query; fewer moving parts for a 6-sprint build.
- Trade-offs: pgvector/PostGIS at very large scale may need to be split out later (post-POC) if data volumes grow well beyond pilot scope.
