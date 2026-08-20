import { expect, setupE2eUser, test } from "./fixtures";

test("protects Analyze without a session", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("renders the stored-facts Analyze shell for the E2E user", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analyze");
  await expect(page.getByRole("heading", { name: "분석", exact: true })).toBeVisible();
  await expect(page.getByText("초기 추정 모델이며 의료 진단이 아닙니다.")).toBeVisible();

  const details = page.locator("details").filter({ hasText: "전체 지표·근거 보기" });
  await details.getByText("전체 지표·근거 보기").click();
  await expect(details.getByText("수면 리듬", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(details.getByText("폰 정리", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(details.getByText(/초기 추정/).first()).toBeVisible();
});
