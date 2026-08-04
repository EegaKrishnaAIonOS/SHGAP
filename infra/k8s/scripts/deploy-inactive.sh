#!/usr/bin/env bash
# T24/ADR-0033: deploys a new image tag to whichever color is currently
# INACTIVE (never touches the color live traffic is on), and waits for its
# rollout to succeed. Pairs with switch-traffic.sh: deploy-inactive.sh
# first, smoke-test the inactive color directly, THEN switch-traffic.sh to
# actually cut traffic over. See docs/runbooks/blue-green-deploy.md.
#
# Usage: deploy-inactive.sh <service> <image-tag>
#   ./deploy-inactive.sh core-api sha-abc1234
set -euo pipefail

SERVICE="${1:?Usage: deploy-inactive.sh <service> <image-tag>}"
IMAGE_TAG="${2:?Usage: deploy-inactive.sh <service> <image-tag>}"
NAMESPACE="${NAMESPACE:-shgap}"
REGISTRY_IMAGE="${REGISTRY_IMAGE:-ghcr.io/eegakrishnaaionos/shgap/$SERVICE}"

ACTIVE="$(kubectl get service "$SERVICE" -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}')"
if [[ "$ACTIVE" == "blue" ]]; then
  INACTIVE="green"
else
  INACTIVE="blue"
fi

echo "$SERVICE: '$ACTIVE' is currently live — deploying $IMAGE_TAG to the inactive color, '$INACTIVE'."
kubectl set image "deployment/$SERVICE-$INACTIVE" "$SERVICE=$REGISTRY_IMAGE:$IMAGE_TAG" -n "$NAMESPACE"
kubectl rollout status "deployment/$SERVICE-$INACTIVE" -n "$NAMESPACE" --timeout=180s

echo
echo "$SERVICE-$INACTIVE is rolled out and ready, but is NOT yet receiving real traffic."
echo "Smoke-test it directly (e.g. via a port-forward to a $INACTIVE-labeled pod), then:"
echo "  ./switch-traffic.sh $SERVICE $INACTIVE"
