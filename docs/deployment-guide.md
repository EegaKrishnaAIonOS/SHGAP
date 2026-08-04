# Deployment guide

Three real, distinct things this guide covers, in increasing order of how close they are to a real cloud deployment:

1. **Local development** — one service at a time, hot-reloading (`npm run dev`). Already covered in the root [README](../README.md); not repeated here.
2. **Local production-rehearsal** — the exact container images CI builds, running together via Docker Compose, including a real Prometheus/Grafana/Loki/Alertmanager stack. **This has actually been built and run** — every command below was executed for real while writing this guide, not copied from a template.
3. **Real cloud deployment** — Terraform + Kubernetes, written and locally validated (`terraform validate`, `kubectl kustomize`) but **not applied against a live cloud account** — no cloud credentials exist in this environment (see `docs/adr/0033-...md` for why, and what a real operator does with this instead of code changes).

---

## 1. Local production-rehearsal (Docker Compose)

Runs all 5 application services (built from the same `apps/*/Dockerfile` CI uses) plus Postgres/Redis/MinIO/ClamAV plus the full monitoring stack, all on one Docker network.

```bash
docker compose \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.apps.yml \
  -f infra/docker-compose.monitoring.yml \
  up -d --build
```

Day-to-day development is unaffected — `docker compose -f infra/docker-compose.yml up -d` alone still starts just the four backing services, exactly as before this task.

### What you get, and how to verify each piece is real (not just "started")

| Check                            | Command                                                               | What "working" looks like                                                                          |
| -------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Web app                          | `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080`      | `200`                                                                                              |
| core-api liveness                | `curl http://localhost:8080/api/health`                               | `{"status":"ok",...}`                                                                              |
| core-api readiness               | `curl http://localhost:3000/health/ready`                             | `{"status":"ok","checks":{"database":true,"redis":true}}`                                          |
| core-api Swagger                 | open `http://localhost:3000/api/docs`                                 | Real OpenAPI UI, every route grouped by `@ApiTags`                                                 |
| notification-service Swagger     | open `http://localhost:3001/api/docs`                                 | Same, for `/notifications/dispatch`                                                                |
| ml-services / voice-service docs | `http://localhost:8001/docs`, `http://localhost:8002/docs`            | FastAPI's own auto-generated docs                                                                  |
| Prometheus targets               | `http://localhost:9090/targets`                                       | All 5 jobs (`core-api`, `notification-service`, `ml-services`, `voice-service`, `prometheus`) `UP` |
| Prometheus alert rules           | `http://localhost:9090/alerts`                                        | 4 rules loaded, state `inactive` (not `pending`/`firing`, under normal load)                       |
| Grafana dashboard                | `http://localhost:3002` (admin / `shgap_dev_password`) → SHGAP folder | "SHGAP Platform Overview" showing live, moving request-rate/latency graphs                         |
| Loki logs                        | Grafana → Explore → Loki → `{compose_service="core-api"}`             | Real JSON log lines from the running container                                                     |
| Alertmanager                     | `http://localhost:9093`                                               | Cluster status `ready`                                                                             |

All of the above were confirmed exactly this way while building T24 — this table is a real checklist, not an aspirational one.

### Real gap this rehearsal surfaced and fixed

The web container's nginx had no `/api`/`/voice-api` reverse-proxy rules and no SPA-routing fallback — `vite.config.ts`'s own comment had named this as the intended real setup ("a real deployment would front both with a single reverse proxy the same way") but it was never built until this task. See `apps/web/nginx.conf` and ADR-0033.

---

## 2. Real cloud deployment (Terraform + Kubernetes)

**Target:** AWS `ap-south-1` (Mumbai) — a literal India region, chosen as the concrete provider to write against (ADR-0013 requires a real MeitY-empanelled cloud for an actual production rollout, which is a procurement decision outside this repo's scope; swapping the provider block is the portability Terraform exists for).

### 2.1 Provision infrastructure

```bash
cd infra/terraform
terraform init
terraform plan   # review every resource before applying — this creates real, billed infrastructure
terraform apply
```

Real prerequisite: AWS credentials with permission to create VPC/RDS/ElastiCache/S3/EKS/IAM/Secrets Manager resources (`aws configure` or equivalent). **This step was not run in this environment** — no AWS account/credentials exist here; `terraform validate` and `terraform fmt -check` were run instead (see ADR-0033's verification section) as the closest real check available without spending real money.

### 2.2 Point kubectl at the new cluster

```bash
$(terraform output -raw configure_kubectl)
kubectl get nodes   # confirm the node group actually joined
```

### 2.3 Populate real secrets

`infra/terraform/modules/secrets` creates the Secrets Manager entries with generated JWT/PII-encryption secrets and the real database/Redis URLs already filled in — but leaves every third-party provider credential (MSG91, WhatsApp, Exotel, SES, Groq, Sarvam) blank, matching this repo's "no fabricated secret" rule for every other external integration. An operator fills these in for real:

```bash
aws secretsmanager put-secret-value \
  --secret-id shgap/production/notification-service \
  --secret-string '{"MSG91_AUTH_KEY": "<real key>", ...}'
```

Then sync into the cluster (either `kubectl create secret` once, or install [External Secrets Operator](https://external-secrets.io/) to keep the cluster's Secrets automatically in sync with Secrets Manager going forward — the preferred real approach past a first manual bootstrap). See `infra/k8s/base/secrets.example.yaml` for the exact shape each service expects.

### 2.4 Deploy the application

```bash
kubectl apply -k infra/k8s/base/
kubectl apply -k infra/k8s/monitoring/
```

Both `kubectl kustomize` renders were validated for real while writing this guide (`kubectl kustomize infra/k8s/base/`, `kubectl kustomize infra/k8s/monitoring/` — both succeed cleanly). Applying against a live cluster was not — again, no live cluster exists in this environment.

### 2.5 Point DNS / TLS at the Ingress

`infra/k8s/base/ingress.yaml` provisions an AWS ALB (via the AWS Load Balancer Controller — installed separately, not by this repo's manifests, since it's cluster-scoped infrastructure a specific cluster operator installs once, not per-app). Replace `REPLACE_WITH_REAL_ACM_CERTIFICATE_ARN` with a real ACM certificate for the real domain before applying.

### 2.6 Releasing a new version

See [`docs/runbooks/blue-green-deploy.md`](runbooks/blue-green-deploy.md) — deploy to the inactive color, smoke-test it directly, then switch traffic. CI already builds and pushes every image to GHCR on every push to `master` (`.github/workflows/ci.yml`); the actual `deploy-inactive.sh` / `switch-traffic.sh` steps are a separate, deliberately manual-trigger workflow (`.github/workflows/cd.yml`) — see that file's own header comment for why this isn't automatic.

---

## 3. What's real vs. what's a documented gap

| Area                                                        | Status                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker images for all 5 services                            | Real, built and run locally; CI builds and pushes them on every `master` push                                                                                                                                                                                       |
| Local production-rehearsal (Compose)                        | Real, run and verified (table above)                                                                                                                                                                                                                                |
| Terraform (network/database/cache/storage/EKS/secrets)      | Real HCL, `terraform validate` clean, **not applied** (no cloud credentials in this environment)                                                                                                                                                                    |
| Kubernetes manifests (blue/green, HPA, Ingress, monitoring) | Real YAML, `kubectl kustomize` renders clean, **not applied to a live cluster**                                                                                                                                                                                     |
| Monitoring (Prometheus/Grafana/Loki/Alertmanager)           | Real, running, verified with live data — in the Compose rehearsal. The Kubernetes version is the same config translated to K8s-native discovery, unverified against a live cluster for the same reason as above                                                     |
| Backups                                                     | Real, tested `pg_dump`/`pg_restore` cycle (see `docs/runbooks/backup-restore.md`) against local dev data. RDS automated snapshots and the in-cluster `CronJob` are real Terraform/K8s config, unverified against live infrastructure                                |
| Blue/green deploy + rollback                                | Real scripts (`infra/k8s/scripts/`), logic verified by inspection and against `kubectl`'s dry-run rendering — not yet run against a live rollout, since no live cluster exists to roll out to                                                                       |
| Alerting → Slack/PagerDuty                                  | **Not done** — Alertmanager routes to a real, working log-sink webhook (`alert-log-sink`) instead, by design (no real Slack/PagerDuty account exists for this pilot) — see `infra/monitoring/alertmanager/alertmanager.yml`'s own comment for the real swap-in path |
| Distributed tracing (Jaeger/Tempo)                          | **Not done** — named as real follow-up work in `docs/runbooks/slow-responses.md`, not attempted here                                                                                                                                                                |
| PersistentVolumeClaims for Prometheus/Grafana/Loki          | **Not done** — the Kubernetes manifests use `emptyDir` (data lost on pod restart); each manifest's own comment flags this as the real next step for a durable production deployment                                                                                 |
| WAF rules                                                   | **Not done** — the Ingress is annotated for an ALB (where WAF rules attach) but no `WAFv2WebACL` resource exists yet; real follow-up once a specific ingress controller is installed on a real cluster                                                              |

Nothing in this list is silently skipped — every gap above is named here and, where relevant, in the manifest/script comment closest to it, matching this project's standing rule: state the real gap, don't fabricate having closed it.
