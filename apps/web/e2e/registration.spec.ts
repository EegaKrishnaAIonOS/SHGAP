import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * A fresh, never-seen-before phone number so this test exercises the real
 * first-login-then-register golden path (auth.service.ts upserts a brand
 * new user on first requestOtp) and creates a real new SHG row each run,
 * rather than colliding with the demo accounts' already-registered SHGs.
 */
function freshTestPhone(): string {
  const digits = String(Date.now()).slice(-9);
  return `7${digits}`;
}

test("a brand new member can log in for the first time and register their SHG", async ({
  page,
}) => {
  const phone = freshTestPhone();
  await loginAs(page, phone);

  // No SHG yet for this brand-new user -> catalogue redirects to registration.
  await expect(page.getByText("Register your SHG before adding products")).toBeVisible();
  await page.getByRole("link", { name: "Register my SHG" }).click();
  await expect(page).toHaveURL("/register");

  await page.getByLabel("SHG name").fill(`E2E Test SHG ${phone}`);
  await page.getByLabel("Group type").selectOption({ label: "Food products" });
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel("District").selectOption({ label: "Anantapur" });
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText(`E2E Test SHG ${phone}`)).toBeVisible();
  await page.getByRole("button", { name: "Submit registration" }).click();

  await expect(page.getByText("Go to product catalogue")).toBeVisible();
});
