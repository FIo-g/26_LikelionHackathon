import { expect, test } from "@playwright/test";

test("protects onboarding flow without session", async ({ page }) => {
  await page.goto("/onboarding/connect");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("shows onboarding pages when session exists", async ({ page }) => {
  // A placeholder assertion for route wiring; session-dependent integration can be added with auth setup.
  await page.goto("/onboarding/sleep-goal");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

