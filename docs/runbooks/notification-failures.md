# Runbook: NotificationDeliveryFailureRateHigh alert

**Fires when:** more than 20% of notification jobs fail over 15 minutes (`infra/monitoring/prometheus/alert_rules.yml`), measured from the real `notification_jobs_total{outcome="failure"}` counter `NotificationsProcessor` increments on every terminal (all-retries-exhausted) failure — see `apps/notification-service/src/notifications/notifications.processor.ts`.

## 1. Which channel?

```promql
sum(rate(notification_jobs_total{outcome="failure"}[15m])) by (channel)
```

SMS/WhatsApp/Voice/Email each have an independent, real provider (MSG91/WhatsApp Business/Exotel/SES respectively — ADR-0011) — a spike in one channel almost always means that one provider, not a platform-wide bug.

## 2. Read the real failure reason

Every failed `Notification` row has `failureReason` populated with the actual provider error (`notifications.processor.ts` records it before re-throwing for BullMQ's retry) — this is a real, specific string, not a generic "failed":

```sql
SELECT channel, "failureReason", count(*) FROM notifications
WHERE status = 'FAILED' AND created_at > now() - interval '1 hour'
GROUP BY channel, "failureReason" ORDER BY count(*) DESC;
```

## 3. Common real causes

- **No provider credentials configured** — if `MSG91_AUTH_KEY`/`WHATSAPP_ACCESS_TOKEN`/etc. are unset, every send falls back to the console/dev-stub provider (ADR-0011/ADR-0022), which never fails but also never really sends. This alert firing with 100% failure and every `failureReason` blank/absent, in an environment that should have real credentials, means the Secret (`notification-service-secrets` — see `infra/k8s/base/secrets.example.yaml`) wasn't actually populated with real values after being created.
- **DLT/template-ID mismatch (SMS/WhatsApp)** — MSG91 SMS and WhatsApp Business both require pre-registered template IDs (`apps/notification-service/src/notifications/templates/templates.ts`); a `failureReason` mentioning a template/DLT rejection means a template was changed in code without being re-registered with the provider — a real coordination step outside this repo, not a code fix.
- **Real provider outage** — check the specific provider's own status page. Jobs will keep retrying (BullMQ's configured `attempts`/backoff) and self-resolve once the provider recovers; this alert clearing on its own after the provider's outage ends is the expected, correct behavior, not something that needs manual intervention.

## 4. If OTP delivery specifically is affected

This is the highest-severity case — a member/official who can't receive an OTP can't log in at all. Check `channel="SMS"` and `failureReason` specifically for OTP-event notifications; if MSG91 itself is down, there is currently no automatic fallback channel for OTP (a real, named gap — OTP is SMS-only today, see ADR-0022) and this should be escalated immediately, not left to retry.
