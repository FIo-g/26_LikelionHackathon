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
  await expect(details.getByText("기록 필요", { exact: true }).first()).toBeVisible();
});

test("keeps long mobile report copy inside its card", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analyze");

  const report = page.locator('section[aria-labelledby="analysis-report-title"]');
  await expect(report).toBeVisible();
  await report.locator("p").nth(1).evaluate((paragraph) => {
    paragraph.textContent = "https://example.test/".concat("unbroken-report-copy-".repeat(40));
  });

  const dimensions = await report.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  const reportBox = await report.boundingBox();
  const disclaimerBox = await report.getByText("초기 추정 모델이며 의료 진단이 아닙니다.").boundingBox();

  if (!reportBox || !disclaimerBox) throw new Error("Expected the report and disclaimer to have layout boxes");
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(disclaimerBox.y + disclaimerBox.height).toBeLessThanOrEqual(reportBox.y + reportBox.height + 1);
});

test("moves focus to the actual data basis from the desktop Analyze control", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/analyze");

  await page.getByRole("button", { name: "분석 기준 보기" }).click();
  await expect(page.locator("#analysis-data-basis")).toBeFocused();
});
