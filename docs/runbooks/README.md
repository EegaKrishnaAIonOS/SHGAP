# Operational runbooks

Real, incident-shaped procedures — each one either ties directly to a Prometheus alert this platform actually fires (`infra/monitoring/prometheus/alert_rules.yml`), or a real operational procedure (deploy/rollback, backup/restore) this task built and tested.

| Runbook                                              | For                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [service-down.md](service-down.md)                   | `ServiceDown` alert — a service stopped responding to health checks entirely                    |
| [slow-responses.md](slow-responses.md)               | `ResponseTimeSLOBreached` alert — p95 latency over the 3s target                                |
| [high-error-rate.md](high-error-rate.md)             | `HighErrorRate` alert — over 5% of requests returning 5xx                                       |
| [notification-failures.md](notification-failures.md) | `NotificationDeliveryFailureRateHigh` alert — over 20% of SMS/WhatsApp/voice/email jobs failing |
| [blue-green-deploy.md](blue-green-deploy.md)         | Deploying a new release and rolling it back                                                     |
| [backup-restore.md](backup-restore.md)               | Backing up and restoring Postgres                                                               |

See also: [docs/data-model.md](../data-model.md), [docs/ml-model-cards.md](../ml-model-cards.md), [docs/deployment-guide.md](../deployment-guide.md), [docs/architecture/README.md](../architecture/README.md).
