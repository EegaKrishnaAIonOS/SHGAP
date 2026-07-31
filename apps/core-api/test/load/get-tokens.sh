#!/usr/bin/env bash
# T23 (ADR-0032): mints real access tokens for the k6 load test by driving
# the actual phone-OTP login flow (request-otp -> read OTP from Redis ->
# verify-otp) against a live core-api — k6's JS sandbox can't shell out to
# `docker exec redis-cli`, so this runs once before `k6 run` and writes the
# tokens k6 reads back in via `open()`. No bypass endpoint exists or should
# exist; this is the same manual flow used for every OTP check in this repo.
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
OUT_FILE="$(dirname "$0")/tokens.json"

mint_token() {
  local phone="$1"
  curl -s -X POST "$API_BASE/auth/request-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$phone\"}" > /dev/null

  local otp
  otp="$(docker exec shgap-redis redis-cli GET "otp:code:$phone" | tr -d '\r')"
  if [ -z "$otp" ] || [ "$otp" = "(nil)" ]; then
    echo "No OTP found in Redis for $phone" >&2
    exit 1
  fi

  curl -s -X POST "$API_BASE/auth/verify-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$phone\",\"otp\":\"$otp\"}" \
    | node -e "process.stdin.once('data', d => process.stdout.write(JSON.parse(d).accessToken))"
}

echo "Minting load-test tokens against $API_BASE ..." >&2
# All 7 real seeded demo accounts (database/seed/demo-data.ts) — since
# T23/ADR-0032 keys the global throttle per authenticated user id, spreading
# load across every real account it can (rather than one shared token)
# is what makes this an honest simulation of distinct concurrent users
# instead of accidentally load-testing a single user's own rate limit.
OFFICIAL_TOKENS_JSON="[$(mint_token 9000000010 | sed 's/.*/"&"/'),$(mint_token 9000000011 | sed 's/.*/"&"/'),$(mint_token 9000000012 | sed 's/.*/"&"/'),$(mint_token 9000000013 | sed 's/.*/"&"/')]"
MEMBER_TOKENS_JSON="[$(mint_token 9000000001 | sed 's/.*/"&"/'),$(mint_token 9000000002 | sed 's/.*/"&"/'),$(mint_token 9000000003 | sed 's/.*/"&"/')]"

cat > "$OUT_FILE" <<EOF
{
  "officialTokens": $OFFICIAL_TOKENS_JSON,
  "memberTokens": $MEMBER_TOKENS_JSON
}
EOF

echo "Wrote $OUT_FILE (tokens expire in JWT_ACCESS_EXPIRES_IN — mint fresh right before running k6)" >&2
