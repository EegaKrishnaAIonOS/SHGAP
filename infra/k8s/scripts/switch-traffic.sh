#!/usr/bin/env bash
# T24/ADR-0033: the real blue/green switch — patches a Service's selector
# from one color to the other. This is also the rollback mechanism: run it
# again with the previous color to switch back, in seconds, with no
# redeploy and no image pull. See docs/runbooks/blue-green-deploy.md for
# the full deploy procedure this script is one step of (deploy to the
# inactive color, smoke-test it directly via its color-specific pod
# selector, THEN switch).
#
# Usage: switch-traffic.sh <service> <blue|green>
#   ./switch-traffic.sh core-api green
set -euo pipefail

SERVICE="${1:?Usage: switch-traffic.sh <service> <blue|green>}"
COLOR="${2:?Usage: switch-traffic.sh <service> <blue|green>}"
NAMESPACE="${NAMESPACE:-shgap}"

if [[ "$COLOR" != "blue" && "$COLOR" != "green" ]]; then
  echo "Color must be 'blue' or 'green', got: $COLOR" >&2
  exit 1
fi

CURRENT="$(kubectl get service "$SERVICE" -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}')"
if [[ "$CURRENT" == "$COLOR" ]]; then
  echo "$SERVICE is already pointed at $COLOR — nothing to do."
  exit 0
fi

echo "Verifying $SERVICE-$COLOR is ready before switching any real traffic to it..."
kubectl rollout status "deployment/$SERVICE-$COLOR" -n "$NAMESPACE" --timeout=120s

echo "Switching $SERVICE from $CURRENT to $COLOR..."
kubectl patch service "$SERVICE" -n "$NAMESPACE" \
  -p "{\"spec\":{\"selector\":{\"app\":\"$SERVICE\",\"version\":\"$COLOR\"}}}"

echo "$SERVICE now serves real traffic from $COLOR. Previous color ($CURRENT) is still running — scale it down manually once $COLOR is confirmed stable, or leave it warm for a fast rollback:"
echo "  ./switch-traffic.sh $SERVICE $CURRENT"
