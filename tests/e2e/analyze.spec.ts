import { expect, test } from "@playwright/test";

test("protects Analyze without a session", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("renders the stored-facts Analyze shell for the E2E user", async ({ page }) => {
  await page.request.post("/__e2e/setup");
  await page.goto("/analyze");
  await expect(page.getByRole("heading", { name: "분석" })).toBeVisible();
  await expect(page.getByText("초기 추정 모델이며 의료 진단이 아닙니다.")).toBeVisible();
});
