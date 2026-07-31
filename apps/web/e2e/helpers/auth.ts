import type { Page } from "@playwright/test";
import { readOtpFromRedis } from "./otp";

/**
 * Drives the real two-step phone -> OTP login flow (LoginPage.tsx) end to
 * end against a live core-api + Redis, using one of the seeded demo
 * accounts (database/seed/demo-data.ts) — no mocked network calls.
 */
export async function loginAs(page: Page, phone: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Phone number").fill(phone);

  // `.click()` only waits for the click event itself, not for the
  // request-otp call it triggers (handleSendOtp fires-and-awaits
  // asynchronously inside the React event handler) — reading Redis before
  // that real network round trip actually completes is a race that
  // intermittently finds no OTP yet, or a stale one from a previous run.
  // Waiting for the real response is what makes this deterministic.
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/auth/request-otp") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Send OTP" }).click(),
  ]);
  if (!response.ok()) {
    throw new Error(
      `request-otp failed for ${phone}: ${response.status()} ${await response.text()}`,
    );
  }

  const otp = await readOtpFromRedis(phone);
  await page.getByLabel("OTP").fill(otp);

  // Same race as above: the Verify click only waits for the click event,
  // not for verify-otp + the token being stored, so a caller that
  // immediately does a hard navigation (page.goto) right after loginAs()
  // returns can land back on /login because isAuthenticated was still
  // false at that moment. Waiting for the response makes this deterministic.
  const [verifyResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/auth/verify-otp") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Verify" }).click(),
  ]);
  if (!verifyResponse.ok()) {
    throw new Error(
      `verify-otp failed for ${phone}: ${verifyResponse.status()} ${await verifyResponse.text()}`,
    );
  }

  // The response resolving doesn't guarantee the page's own JS has finished
  // storing the token and running its <Navigate> redirect yet — every
  // successful login leaves /login (to /catalogue by default, or wherever
  // ProtectedRoute sent the caller from), so waiting for that is the
  // real completion signal, not an arbitrary delay.
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

export const DEMO_PHONES = {
  shgMember: "9000000001",
  shgMember2: "9000000002",
  shgMember3: "9000000003",
  admin: "9000000010",
  stateOfficial: "9000000011",
  districtOfficial: "9000000012",
  ulbOfficial: "9000000013",
} as const;
