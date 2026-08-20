import { expect, test } from "@playwright/test";

test("shows sign-in screen and keeps returnTo on query", async ({ page }) => {
  await page.goto("/sign-in?returnTo=/record/caffeine?step=brand");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  await page.getByLabel("이메일").fill("user@example.com");
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByText(/비밀번호가 일치하지 않습니다|이메일 또는 비밀번호를 확인해 주세요|등록된 계정이 없습니다|요청을 처리하지 못했습니다/)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("opens sign-up page with onboarding callback path", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "처음 만나요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();
});
