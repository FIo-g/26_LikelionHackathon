import { expect, test } from "@playwright/test";

test("protects record hub without session", async ({ page }) => {
  await page.goto("/record");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("protects every intake flow without session", async ({ page }) => {
  await page.goto("/record/caffeine?step=brand");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.goto("/record/alcohol?step=type");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.goto("/record/meal-health?step=meal");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.goto("/record/sleep-phone?step=sleep");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});
