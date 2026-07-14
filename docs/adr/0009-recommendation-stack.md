# ADR-0009: Embeddings + pgvector/FAISS + LightFM + LightGBM + SHAP for buyer matching

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
Module 4 (Buyer Matching Engine) must recommend buyers to SHGs with a match score, expected demand, and an explanation of "why", then improve from accept/reject feedback — all within pilot-scale data (three districts, limited transaction history).

## Decision
Compute product/buyer embeddings stored in pgvector (with FAISS as an optional accelerator), blend content similarity with collaborative signals via LightFM (handles cold-start well), re-rank with LightGBM learning-to-rank, and generate explanations with SHAP plus human-readable templates.

## Alternatives Considered
- **Pure collaborative filtering** — struggles badly with cold-start (new SHGs/buyers/products dominate a fresh pilot); rejected as the sole approach.
- **Deep two-tower neural recommenders** — can outperform at scale, but need far more interaction data than a 90-day, 3-district pilot will generate; overkill for the POC's validation goal.
- **Black-box ranking without explanations** — simpler, but the POC explicitly must validate "Explainable AI recommendations" and dashboard trust for officials/SHGs; SHAP + templates directly satisfies that requirement.

## Consequences
- Positive: LightFM's hybrid approach handles the cold-start-heavy pilot data realistically; LightGBM re-ranking + SHAP gives both accuracy and the required explainability; pgvector reuses the existing database (ADR-0004) instead of a new vector store.
- Trade-offs: a multi-stage pipeline (embed → hybrid recommend → rank → explain) has more moving parts to tune and test within a one-week sprint (T17) than a single-model approach.
