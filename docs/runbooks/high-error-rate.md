# Runbook: HighErrorRate alert

**Fires when:** more than 5% of a service's requests return a 5xx status over 5 minutes (`infra/monitoring/prometheus/alert_rules.yml`).

## 1. Find which endpoint, not just which service

```promql
sum(rate(http_requests_total{job="<service>", status_code=~"5.."}[5m])) by (route)
```

A single hot endpoint failing is a very different problem from every endpoint failing at once (the latter usually means the dependency-level issue below, not a code bug in one handler).

## 2. Read the actual error

```bash
docker logs shgap-<service> --tail 200 | grep -i error
# or, via the real Loki pipeline this platform now has (T24/ADR-0033):
# Grafana → Explore → Loki → {compose_service="<service>"} |= "ERROR"
```

`AllExceptionsFilter` (core-api/notification-service) and each FastAPI service's own exception handling log the real stack trace — this is almost always enough to identify the actual cause without guessing.

## 3. Common real causes already found in this platform's own history

- **Database connection exhaustion** — check `/health/ready`'s `database` check across all replicas; if it's failing broadly, this is a real infra issue (connection pool size vs. real concurrent load), not an application bug.
- **A downstream service is down** — core-api calls ml-services/notification-service; ml-services calls Postgres; voice-service calls core-api and ml-services. Check the _called_ service's own health before assuming the _calling_ service has the bug (`ServiceDown` may already be firing for the real root cause).
- **A real third-party API outage** (Groq, Sarvam, MSG91, WhatsApp, Exotel, SES) — every one of these has a real, understood failure mode already handled in code (falls back to a console/dev-stub provider or returns an honest error, per ADR-0011/ADR-0019/ADR-0022) rather than crashing; a spike in _that specific_ provider's errors in the logs, with the rest of the platform healthy, points here.

## 4. If it's a bad deploy

```bash
./infra/k8s/scripts/switch-traffic.sh <service> <previous-color>
```

See `docs/runbooks/blue-green-deploy.md`.

## 5. After resolving

Check whether `AuditLog`/`Notification` rows from the affected window need reconciliation — a request that 500'd partway through a mutation may have left a real, honestly-recorded partial state (this platform never silently swallows a partial failure — see ADR-0031's audit trail design) that needs a human decision, not an automatic "fix."
