import { test, expect } from "@playwright/test";
import { loginAs, DEMO_PHONES } from "./helpers/auth";

test.describe("Product catalogue", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_PHONES.shgMember);
  });

  test("shows the signed-in SHG's real seeded products", async ({ page }) => {
    await expect(page).toHaveURL("/catalogue");
    await expect(page.getByRole("heading", { name: "Product Catalogue" })).toBeVisible();
    await expect(page.getByText("Mango Pickle (500g jar)")).toBeVisible();
    await expect(page.getByText("Tomato Pickle (500g jar)")).toBeVisible();
  });

  test("search filters the list to matching products only", async ({ page }) => {
    await page.getByLabel("Search").fill("Mango");
    await expect(page.getByText("Mango Pickle (500g jar)")).toBeVisible();
    await expect(page.getByText("Tomato Pickle (500g jar)")).not.toBeVisible();
  });
});
