# ADR-0014: Prometheus + Grafana + Loki for observability

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The POC success criteria include hard, measurable targets — ≥99% uptime and <3s average response time — across five services, which cannot be verified without metrics, dashboards and centralized logs from Sprint 0 onward.

## Decision
Instrument all services with Prometheus metrics, visualize with Grafana dashboards, and centralize logs with Loki, deployed alongside the application stack in the same India-region environment.

## Alternatives Considered
- **Managed SaaS observability (Datadog/New Relic)** — less operational overhead, but adds recurring cost and another vendor with data leaving the India-region deployment, in tension with ADR-0013's data-residency goal.
- **Logs/metrics only via cloud-provider-native tooling** — viable, but Prometheus/Grafana/Loki is portable across cloud providers and keeps the stack self-hosted and inspectable, consistent with the deployment diagram's self-managed cluster.

## Consequences
- Positive: uptime/latency SLOs (T23) are directly measurable against the POC's success criteria; portable across any India-region Kubernetes provider; no data leaves the deployment boundary.
- Trade-offs: self-hosting the observability stack is one more thing to deploy, secure and maintain (T22, T24) versus a fully managed SaaS option.
