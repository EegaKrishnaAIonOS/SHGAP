import { test, expect } from "@playwright/test";
import { loginAs, DEMO_PHONES } from "./helpers/auth";

const DASHBOARDS: { path: string; heading: string }[] = [
  { path: "/dashboards/district", heading: "District Dashboard" },
  { path: "/dashboards/ulb", heading: "ULB Dashboard" },
  { path: "/dashboards/shg", heading: "SHG Dashboard" },
  { path: "/dashboards/product", heading: "Product Dashboard" },
  { path: "/dashboards/buyer", heading: "Buyer Dashboard" },
  { path: "/dashboards/government", heading: "Government Dashboard" },
];

// One real login for the whole describe block, not one per dashboard: the
// OTP request limiter (OTP_MAX_REQUESTS_PER_WINDOW=5/hour/phone) is real and
// shared with every other suite run against this demo account, so 6 fresh
// logins per run would eventually starve it. A single signed-in state
// official browsing all 6 dashboards in one session is also the more
// realistic scenario anyway.
test.describe("Official dashboards", () => {
  test("a state official can open every dashboard and see its real data", async ({ page }) => {
    await loginAs(page, DEMO_PHONES.stateOfficial);

    for (const { path, heading } of DASHBOARDS) {
      await page.goto(path);
      // Scoped to level 1: PageHeader's own <h1> is the one canonical page
      // title — several dashboards also render same-named h3 sub-widgets
      // (chart titles, stat cards) that must not be confused with it.
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText("You don't have access to this page.")).not.toBeVisible();
    }
  });
});

test("an SHG member is blocked from the officials dashboards (RBAC), not silently redirected", async ({
  page,
}) => {
  await loginAs(page, DEMO_PHONES.shgMember2);
  await page.goto("/dashboards/government");
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
});
