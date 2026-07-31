import { test, expect } from "@playwright/test";
import { loginAs, DEMO_PHONES } from "./helpers/auth";

test.describe("Admin portal", () => {
  test("ADMIN sees every tab, including Master data, and can open each one", async ({ page }) => {
    await loginAs(page, DEMO_PHONES.admin);
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Admin overview" });
    await expect(nav.getByRole("link", { name: "Master data" })).toBeVisible();

    await nav.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL("/admin/users");
    await nav.getByRole("link", { name: "SHGs" }).click();
    await expect(page).toHaveURL("/admin/shgs");
    await nav.getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL("/admin/products");
    await nav.getByRole("link", { name: "Master data" }).click();
    await expect(page).toHaveURL("/admin/master-data");
  });

  test("a DISTRICT_OFFICIAL can moderate within the admin portal but never sees Master data", async ({
    page,
  }) => {
    await loginAs(page, DEMO_PHONES.districtOfficial);
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Admin overview" });
    await expect(nav.getByRole("link", { name: "Master data" })).not.toBeVisible();

    // The backend is the real source of truth for this restriction (ADR-0018),
    // not just the missing nav link — direct navigation must also be blocked.
    await page.goto("/admin/master-data");
    await expect(page.getByText("You don't have access to this page.")).toBeVisible();
  });
});
