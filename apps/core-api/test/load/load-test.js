/* global __ENV, __VU, __ITER */
// This runs inside k6's own JS VM (via `k6 run`, see get-tokens.sh), not
// Node — __ENV/__VU/__ITER are k6 runtime globals, not undefined variables.
import http from 'k6/http';
import { check, sleep } from 'k6';

// T23 (ADR-0032): validates the sprint plan's "<3s average response and
// >=99% uptime" targets against a live core-api + Postgres + Redis — no
// mocked backend. Run `./get-tokens.sh` first to mint real access tokens
// via the actual phone-OTP login flow (see that script for why it can't be
// done inside this k6 VM). Error rate is used as the uptime proxy, the same
// "state the real, measurable thing" approach T20's dashboards already use
// rather than a fabricated SLA number.
const tokens = JSON.parse(open('./tokens.json'));

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';

export const options = {
  scenarios: {
    health_check: {
      executor: 'ramping-vus',
      exec: 'healthCheck',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 30 },
        { duration: '40s', target: 30 },
        { duration: '10s', target: 0 },
      ],
    },
    // One VU per real seeded account (database/seed/demo-data.ts has exactly
    // 4 officials + 3 SHG members) so this measures 7 genuinely distinct
    // concurrent users, each within their own ADR-0032 per-user throttle
    // bucket — not several VUs artificially sharing one account's budget.
    authenticated_reads: {
      executor: 'constant-vus',
      exec: 'authenticatedReads',
      vus: 7,
      duration: '60s',
    },
    // Real first-time-login entry point (upsert + rate-limit check + SMS
    // dispatch) under light concurrency, using a fresh synthetic phone per
    // iteration so it never trips the 5-requests/hour-per-phone limiter
    // that guards the real demo accounts.
    otp_request_only: {
      executor: 'constant-vus',
      exec: 'requestOtp',
      vus: 3,
      duration: '60s',
    },
  },
  thresholds: {
    http_req_duration: ['avg<3000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health: 200': (r) => r.status === 200 });
  sleep(1);
}

export function authenticatedReads() {
  // Round-robin across every real seeded account so this simulates distinct
  // concurrent officials/members (each with their own throttle bucket under
  // ADR-0032's per-user keying) rather than one shared account's own limit.
  const officialToken =
    tokens.officialTokens[__VU % tokens.officialTokens.length];
  const memberToken = tokens.memberTokens[__VU % tokens.memberTokens.length];
  const officialHeaders = {
    headers: { Authorization: `Bearer ${officialToken}` },
  };
  const memberHeaders = { headers: { Authorization: `Bearer ${memberToken}` } };

  const officialEndpoints = [
    '/analytics/sales/districts',
    '/analytics/sales/categories',
    '/analytics/geo/activity',
    '/analytics/market-prices',
    '/master-data/categories',
  ];
  for (const path of officialEndpoints) {
    const res = http.get(`${BASE_URL}${path}`, officialHeaders);
    check(res, { [`${path}: 200`]: (r) => r.status === 200 });
  }

  // GET /shgs is auto-scoped server-side by role — a plain SHG member's
  // request returns only their own group(s), same as the web app's
  // getMyShg() helper (no separate "self" query param exists).
  const memberRes = http.get(`${BASE_URL}/shgs?pageSize=1`, memberHeaders);
  check(memberRes, { '/shgs?pageSize=1: 200': (r) => r.status === 200 });

  // Real dashboard-browsing pacing, not a zero-delay hammer loop — also
  // keeps each simulated user comfortably under their own 100-req/min
  // throttle bucket (6 requests/iteration) instead of tripping it solely by
  // iterating as fast as the event loop allows.
  sleep(4);
}

export function requestOtp() {
  // 6xxxxxxxxx, unique per VU+iteration, matching PHONE_PATTERN /^[6-9]\d{9}$/.
  const uniqueSuffix = `${__VU}${__ITER}`.padStart(9, '0').slice(-9);
  const phone = `6${uniqueSuffix}`;
  const res = http.post(
    `${BASE_URL}/auth/request-otp`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'request-otp: 200': (r) => r.status === 200 });

  // Unauthenticated, so this is correctly IP-keyed (ADR-0032) rather than
  // per-user — all 3 VUs here share one IP bucket, same as real anonymous
  // login-attempt traffic from one source would. Paced to stay under that
  // shared 100-req/min budget instead of self-inflicting 429s.
  sleep(3);
}
