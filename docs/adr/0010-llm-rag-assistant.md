# ADR-0010: LLM + pgvector RAG for scheme guidance and assistant replies

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
Government scheme guidance is open-ended, document-grounded Q&A that a fixed intent classifier cannot handle well, and answers must be traceable to source documents for trust with SHG members and officials.

## Decision
Chunk and embed Government scheme documents into pgvector, and answer scheme-guidance queries with a retrieval-augmented generation (RAG) pipeline: retrieve top-matching chunks, generate a grounded answer via an LLM, and return source citations alongside the answer.

## Alternatives Considered
- **Fine-tuned QA model without retrieval** — cheaper per call, but answers can't be traced to a source document/citation and go stale whenever scheme rules change; RAG lets documents be updated without retraining.
- **Keyword/FAQ search only** — fails on natural spoken Telugu phrasing and can't synthesize an answer spanning multiple scheme clauses.

## Consequences
- Positive: answers stay grounded and citable (needed for a Government-facing pilot), scheme documents can be updated by re-embedding without retraining any model, reuses the same pgvector store as recommendations (ADR-0004, ADR-0009).
- Trade-offs: adds LLM-call latency/cost per scheme query and depends on an external or self-hosted LLM being reachable from the India-region deployment within DPDP constraints (T12, T22).
