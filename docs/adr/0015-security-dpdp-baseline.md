# ADR-0015: TLS + KMS + pgcrypto + OWASP ZAP + Snyk as the security/DPDP baseline

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The scope note is explicit: "the Application model, implementation and data security must be in accordance with the DPDP Act 2023." This requires consent management, encryption at rest/in transit, tamper-evident audit logging, a right-to-erasure workflow, and general hardening — all layered onto the stack chosen in ADRs 0001-0014.

## Decision
Standardize on TLS everywhere in transit, KMS-backed pgcrypto for encrypting PII fields at rest in PostgreSQL, tamper-evident audit logging across services, and a security-hardening pass using OWASP ZAP (dynamic scanning) and Snyk (dependency scanning) ahead of the Sprint 5 stabilization/deployment (T22-T24).

## Alternatives Considered
- **Application-level encryption library instead of pgcrypto** — more portable across databases, but adds custom crypto code to maintain; pgcrypto is battle-tested and already colocated with the chosen database (ADR-0004).
- **Skip automated scanning, rely on manual review only** — faster short-term, but does not scale across 24 tasks and 5 services, and risks missing the OWASP Top-10 pass the scope requires; automated Snyk/ZAP scans are cheap to run in CI.

## Consequences
- Positive: encryption, audit and consent requirements are addressed by named, well-supported tools rather than bespoke code; ZAP/Snyk integrate into the existing GitHub Actions pipeline (ADR-0012) for continuous checking.
- Trade-offs: KMS/pgcrypto key management and consent/audit workflows add real implementation effort concentrated in Sprint 5 (T22) — this must not be deferred, since it gates DPDP compliance for the whole pilot.
