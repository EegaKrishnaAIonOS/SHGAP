# Runbook: ServiceDown alert

**Fires when:** Prometheus's `up == 0` for a service for 1 minute (`infra/monitoring/prometheus/alert_rules.yml`) — the scrape target itself is unreachable, not just slow or erroring.

## 1. Confirm it's real, not a monitoring blip

```bash
# Docker Compose local rehearsal:
docker ps --filter "name=shgap-<service>"
docker logs shgap-<service> --tail 100

# Kubernetes:
kubectl get pods -n shgap -l app=<service>
kubectl logs -n shgap deployment/<service>-blue --tail 100
```

Check both colors in Kubernetes — a blue/green switch mid-incident can make one color look "down" when it's actually just idle (0 replicas isn't the failure mode here, since HPA `minReplicas` is always ≥2 on both — see `infra/k8s/base/*.yaml`).

## 2. Check the obvious real causes first

- **Readiness, not liveness:** hit `/health/ready` directly (`curl http://<service>/health/ready`) — a 503 with `checks: {database: false}` or `{redis: false}` means the service itself is fine but a real dependency isn't. Fix the dependency, not the service.
- **Crash loop:** `kubectl describe pod <pod>` / `docker inspect shgap-<service>` — look at `restartCount`/exit code. A recent bad deploy is the most common real cause; see the blue/green rollback runbook below.
- **OOMKilled:** `kubectl describe pod` shows `Reason: OOMKilled` — the Deployment's `resources.limits.memory` (see `infra/k8s/base/*.yaml`) is genuinely too low for real traffic; bump it, don't just restart.

## 3. If it's a bad deploy

```bash
./infra/k8s/scripts/switch-traffic.sh <service> <previous-color>
```

This is the real rollback — no redeploy, takes effect in seconds. See `docs/runbooks/blue-green-deploy.md`.

## 4. If it's genuinely down with no clear cause

Restart the specific pod/container (not the whole node/cluster):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.apps.yml restart <service>
# or
kubectl rollout restart deployment/<service>-<active-color> -n shgap
```

Escalate if it recurs — a service that needs restarting more than once in a short window has a real underlying cause this runbook hasn't found yet, not a flaky infrastructure issue to keep working around.
