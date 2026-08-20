import { expect, setupIncompleteOnboardingE2eUser, test } from "./fixtures";

test("protects onboarding flow without session", async ({ page }) => {
  await page.goto("/onboarding/connect");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("completes onboarding through the authenticated UI", async ({ page }, testInfo) => {
  await setupIncompleteOnboardingE2eUser(page.request, testInfo);

  await page.goto("/onboarding/profile");
  await expect(page.getByRole("heading", { name: "나를 먼저 알려주세요" })).toBeVisible();
  await page.getByLabel("닉네임").fill("온보딩 E2E");
  await page.getByLabel("나이").fill("25");
  await page.getByRole("radio", { name: "응답 안 함" }).check();
  await page.getByLabel("키").fill("165");
  await page.getByLabel("몸무게").fill("58");
  await page.getByLabel("생활 시간대").selectOption("Asia/Seoul");
  await expect(page.getByLabel("생활 시간대")).toHaveValue("Asia/Seoul");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/onboarding\/habits$/);

  await page.getByRole("group", { name: "하루 평균 카페인 섭취량" }).getByRole("radio", { name: "1잔 내외" }).check();
  await page.getByRole("group", { name: "하루 평균 식사 횟수" }).getByRole("radio", { name: "3회 이상" }).check();
  await page.getByRole("group", { name: "일주일 평균 음주 횟수" }).getByRole("radio", { name: "1~2회" }).check();
  await page.getByRole("group", { name: "일주일 평균 운동 횟수" }).getByRole("radio", { name: "2~3회" }).check();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/onboarding\/sleep-goal$/);

  await page.getByRole("button", { name: "시간 수정" }).click();
  await page.getByLabel("취침 시간").fill("23:30");
  await page.getByLabel("기상 시간").fill("07:00");
  await page.getByRole("button", { name: "시간 적용" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/onboarding\/connect$/);

  await expect(page.getByRole("heading", { name: "가능한 데이터만 편하게 연결하세요" })).toBeVisible();
  await page.getByRole("button", { name: "수면 플랜 시작하기" }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('main[data-lunar-screen="today"]')).toBeVisible();
});

test("redirects an incomplete user away from future onboarding steps", async ({ page }, testInfo) => {
  await setupIncompleteOnboardingE2eUser(page.request, testInfo);

  await page.goto("/onboarding/connect");
  await expect(page).toHaveURL(/\/onboarding\/profile$/);
  await expect(page.getByRole("heading", { name: "나를 먼저 알려주세요" })).toBeVisible();
});
