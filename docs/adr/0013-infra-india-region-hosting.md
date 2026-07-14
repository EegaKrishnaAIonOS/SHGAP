# ADR-0013: India-region hosting on Docker/Kubernetes with Terraform, for DPDP data residency

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The POC scope explicitly requires the application model, implementation and data security to be DPDP Act 2023-compliant, hosted by the vendor during the pilot, on an India-region / MeitY-empanelled host, while still needing fast, repeatable environment setup (dev/staging) across a 90-day timeline.

## Decision
Containerize every service with Docker, deploy to Kubernetes (or docker-compose for local/dev) in an India-region, MeitY-empanelled cloud, and define all infrastructure as Terraform so dev/staging/prod environments are reproducible and auditable.

## Alternatives Considered
- **Global-region cloud (default US/EU regions)** — simpler defaults, but violates DPDP Act 2023 data-residency expectations for citizen/SHG data; rejected outright.
- **Bare-VM deployment without containers/IaC** — faster initial setup, but harder to reproduce across dev/staging/prod and harder to roll back cleanly (T24 needs blue/green + rollback).
- **Fully serverless (managed functions) architecture** — could reduce ops overhead, but complicates the stateful voice-service WebSocket streaming and long-running ML batch jobs central to Modules 2-4.

## Consequences
- Positive: data residency compliance is built into the hosting choice from day one; Terraform + Docker/K8s gives reproducible environments and supports blue/green deploys with rollback (T24); matches the deployment diagram.
- Trade-offs: Kubernetes adds operational overhead versus a simpler PaaS; mitigated by also supporting docker-compose for local development (T03).
