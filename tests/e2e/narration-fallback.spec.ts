import { expect, setupE2eUser, test } from "./fixtures";

test("keeps the deterministic Analyze report available without narration configuration", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/analyze");

  await expect(page.getByRole("heading", { name: "분석" })).toBeVisible();
  await expect(page.getByText("초기 추정 모델이며 의료 진단이 아닙니다.")).toBeVisible();
});
