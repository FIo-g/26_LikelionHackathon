import { expect, setupE2eUser, test } from "./fixtures";

test("shows scoped account settings with truthful manual-only connection state", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/account");

  await expect(page.getByRole("heading", { name: "계정 설정" })).toBeVisible();
  await expect(page.getByText("직접 입력 사용 중")).toBeVisible();
  await expect(page.getByText("휴대폰 연동 준비 중")).toBeVisible();
  await expect(page.getByText("자동 입력 중")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "데이터 관리" })).toBeVisible();
});

test("protects Account without a session", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});
