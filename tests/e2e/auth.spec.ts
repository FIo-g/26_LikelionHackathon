import { expect, test } from "@playwright/test";

test("shows sign-in screen and keeps returnTo on query", async ({ page }) => {
  await page.goto("/sign-in?returnTo=/record/caffeine?step=brand");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  await page.getByLabel("이메일").fill("user@example.com");
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();
});

test("opens sign-up page with onboarding callback path", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
  await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();
});
