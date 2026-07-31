import { test, expect } from "@playwright/test";
import { loginAs, DEMO_PHONES } from "./helpers/auth";
import { readOtpFromRedis } from "./helpers/otp";

test.describe("Phone-OTP login", () => {
  test("real OTP round trip logs an SHG member in and lands on the catalogue", async ({ page }) => {
    await loginAs(page, DEMO_PHONES.shgMember);
    await expect(page).toHaveURL("/catalogue");
  });

  test("visiting a protected route while logged out redirects to login, then back after login", async ({
    page,
  }) => {
    await page.goto("/voice-assistant");
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Phone number").fill(DEMO_PHONES.shgMember2);
    await page.getByRole("button", { name: "Send OTP" }).click();
    const otp = await readOtpFromRedis(DEMO_PHONES.shgMember2);
    await page.getByLabel("OTP").fill(otp);
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL("/voice-assistant");
  });

  test("an incorrect OTP is rejected with an inline error, not a silent redirect", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Phone number").fill(DEMO_PHONES.shgMember3);
    await page.getByRole("button", { name: "Send OTP" }).click();

    await page.getByLabel("OTP").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("change number returns to the phone step and clears the OTP field", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone number").fill(DEMO_PHONES.shgMember);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.getByLabel("OTP")).toBeVisible();

    await page.getByRole("button", { name: "Change phone number" }).click();

    await expect(page.getByLabel("Phone number")).toBeVisible();
  });
});
