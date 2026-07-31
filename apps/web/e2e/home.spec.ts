import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads unauthenticated and links out to every wireframe route", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("SHG Smart Market Linkage Platform")).toBeVisible();
    await expect(page.getByRole("link", { name: /District Dashboard/i })).toHaveAttribute(
      "href",
      "/dashboards/district",
    );
    await expect(page.getByRole("link", { name: /Admin/i })).toHaveAttribute("href", "/admin");
  });
});
