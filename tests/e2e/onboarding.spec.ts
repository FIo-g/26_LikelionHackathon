import { expect, setupIncompleteOnboardingE2eUser, test } from "./fixtures";

test("protects onboarding flow without session", async ({ page }) => {
  await page.goto("/onboarding/connect");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("completes onboarding through the authenticated UI", async ({ page }, testInfo) => {
  await setupIncompleteOnboardingE2eUser(page.request, testInfo);

  await page.goto("/onboarding/connect");
  await expect(page.getByRole("heading", { name: "가능한 데이터만 편하게 연결하세요" })).toBeVisible();
  await page.getByRole("button", { name: "직접 입력으로 시작하기" }).click();
  await expect(page).toHaveURL(/\/onboarding\/sleep-goal$/);

  await page.getByLabel("취침 시간").fill("23:00");
  await page.getByLabel("기상 시간").fill("07:00");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/onboarding\/habits$/);

  await page.getByRole("radio", { name: "가끔" }).check();
  await page.getByRole("radio", { name: "늦은 편" }).check();
  await page.getByRole("radio", { name: "주 1~2회" }).check();
  await page.locator('input[name="phoneUsage"][value="medium"]').check();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/onboarding\/profile$/);

  await page.getByLabel("닉네임").fill("온보딩 E2E");
  await page.getByLabel("생활 시간대").selectOption("Asia/Seoul");
  await expect(page.getByLabel("생활 시간대")).toHaveValue("Asia/Seoul");
  await page.getByRole("button", { name: "완료" }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('main[data-lunar-screen="today"]')).toBeVisible();
});
