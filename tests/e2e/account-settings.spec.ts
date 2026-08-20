import { expect, setupE2eUser, test, visibleText } from "./fixtures";

test("shows scoped account settings with truthful manual-only connection state", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/account");

  await expect(page.getByRole("heading", { name: "나와 목표를 관리해요" })).toBeVisible();
  await expect(page.locator("#connections").getByText("직접 입력 사용 중", { exact: true })).toBeVisible();
  await expect(visibleText(page, "휴대폰 연동 준비 중")).toBeVisible();
  await expect(page.getByText("자동 입력 중")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "데이터 관리" })).toBeVisible();
});

test("protects Account without a session", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});
