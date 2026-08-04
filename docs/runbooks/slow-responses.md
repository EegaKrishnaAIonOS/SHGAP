# Runbook: ResponseTimeSLOBreached alert

**Fires when:** p95 request duration for a service exceeds 3s for 5 minutes (`infra/monitoring/prometheus/alert_rules.yml`) — the exact threshold T23/ADR-0032's k6 load test validated against, now watched continuously instead of only during a manual load-test pass.

## 1. Look at the Grafana dashboard first

Open **SHGAP Platform Overview** (Grafana → SHGAP folder) — the "p95 response time by service" panel shows which service and, cross-referencing "Request rate by service," whether this correlates with a real traffic spike or is happening at normal/low load (the latter is a more serious sign — real load isn't causing it, so scaling out won't fix it).

## 2. Check for the known real cause from T23

T23/ADR-0032 already found and fixed one real cause of this exact symptom: the global per-IP rate limiter throttling requests (`IdentityThrottlerGuard`). If `http_requests_total{status_code="429"}` is elevated for this job, that's the limiter doing its job under real load, not a performance bug — see whether the load is legitimate (scale out) or abusive (investigate the source IP/user).

```promql
sum(rate(http_requests_total{status_code="429"}[5m])) by (job)
```

## 3. Check dependency latency, not just this service

- **Database:** slow queries show up as elevated latency across _every_ endpoint that touches Postgres, not one specific route. Check `pg_stat_statements` (enabled via `infra/terraform/modules/database`'s parameter group) for the actual slow query.
- **ml-services specifically:** the embedding model is loaded once at boot and reused (see `app/main.py`'s own comment) — if _first-request_ latency is the complaint right after a deploy/restart, that's expected model-load cost, not a regression. Sustained slowness after warm-up is the real signal to act on.

## 4. Scale out if it's genuine load

```bash
kubectl scale deployment/<service>-<active-color> --replicas=<N> -n shgap
```

The HPA (`infra/k8s/base/*.yaml`) does this automatically at 70% CPU utilization — manual scaling is for getting ahead of a load spike the HPA hasn't reacted to yet, not a replacement for it.

## 5. If nothing above explains it

Pull a trace: this platform doesn't yet have distributed tracing (Jaeger/Tempo) wired up — a real, named follow-up (see `docs/deployment-guide.md`'s "not yet done" list), not something this runbook can point you to today. Fall back to comparing `http_request_duration_seconds` histograms per route (not just per job) in Prometheus directly to isolate which endpoint is actually slow.
