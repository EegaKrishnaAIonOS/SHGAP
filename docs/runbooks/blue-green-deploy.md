# Runbook: blue/green deploy and rollback

ADR-0013 pre-committed to blue/green + rollback; T24/ADR-0033 is where it's actually built — two full Deployments per service (`<service>-blue`, `<service>-green`, see `infra/k8s/base/*.yaml`), with exactly one "active" at a time via the Service's own `version` selector. Both colors always exist and are always running (never scaled to zero between releases) — the inactive color is where the _next_ release goes before it ever sees real traffic.

## Deploying a new version

```bash
# 1. Deploy the new image to whichever color is currently inactive.
#    Never touches the color live traffic is on.
./infra/k8s/scripts/deploy-inactive.sh core-api sha-abc1234

# 2. Smoke-test the inactive color directly, bypassing the Service entirely —
#    port-forward straight to one of its pods:
kubectl port-forward -n shgap deployment/core-api-green 3000:3000
curl http://localhost:3000/health/ready
# ...run whatever real checks matter for this release...

# 3. Only once you're confident: cut real traffic over.
./infra/k8s/scripts/switch-traffic.sh core-api green
```

Step 3 is a Service selector patch — it takes effect for new connections within seconds, no pod restart, no image pull at switch time (the image was already pulled and running in step 1).

## Rolling back

Literally the same command, run in reverse — the previous color is still running (you never scaled it down):

```bash
./infra/k8s/scripts/switch-traffic.sh core-api blue
```

This is why both colors stay warm rather than one scaling to zero after a switch: a rollback that requires spinning a cold Deployment back up is slower and riskier at exactly the moment (right after a bad deploy) you want the fastest, most reliable path back to a known-good state.

## After a switch is confirmed stable

The old color is still consuming real cluster resources (2+ replicas, per the HPA `minReplicas`). Once you're confident you won't need a fast rollback to it:

```bash
kubectl scale deployment/core-api-blue --replicas=0 -n shgap
```

Scale it back up (to the same replica count the HPA would otherwise manage) before the _next_ deploy targets it — `deploy-inactive.sh` assumes the inactive Deployment is healthy and ready to receive a new image, not scaled to zero.

## Doing this for every service in one release

Repeat the three-step sequence per service (`core-api`, `notification-service`, `ml-services`, `voice-service`, `web`) — there is deliberately no single "deploy everything" script. Each service's release is independently smoke-tested and switched; a bad `ml-services` release should never block or get bundled with a good `core-api` one.
