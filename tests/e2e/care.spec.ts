import { expect, test } from "@playwright/test";

test("protects Care without a session", async ({ page }) => {
  await page.goto("/care");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("renders the manual Care routine and bounded tools", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/__e2e/setup");
  await page.goto("/care");
  await expect(page.getByRole("heading", { name: "Care" })).toBeVisible();
  await expect(page.getByText("직접 입력 사용 중")).toBeVisible();
  await expect(page.getByText("호흡 가이드")).toBeVisible();
  await page.getByRole("button", { name: "시작" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "멈추기" }).first()).toBeVisible();
});
