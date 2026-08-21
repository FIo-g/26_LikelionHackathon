import { expect, setupE2eUser, test } from "./fixtures";

test("protects Care without a session", async ({ page }) => {
  await page.goto("/care");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("renders the manual Care routine and bounded tools", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupE2eUser(page.request, testInfo, { seedPlan: true });
  await page.goto("/care");
  const careScreen = page.locator('main[data-lunar-screen="care"]');
  const breathingProgress = page.getByRole("progressbar", { name: "호흡 가이드 진행" });
  const whiteNoiseProgress = page.getByRole("progressbar", { name: "백색소음 진행" });
  const relaxationProgress = page.getByRole("progressbar", { name: "5분 이완 진행" });
  const breathingCard = breathingProgress.locator("xpath=ancestor::article[1]");
  const whiteNoiseCard = whiteNoiseProgress.locator("xpath=ancestor::article[1]");
  const asmrCard = page.getByLabel("ASMR 음원 준비 중");

  await expect(careScreen).toBeVisible();
  await expect(page.getByRole("heading", { name: "오늘 밤 케어" })).toBeVisible();
  await expect(page.getByText("직접 입력 사용 중")).toBeVisible();
  await expect(page.getByRole("button", { name: "완료" }).first()).toBeVisible();
  await expect(breathingProgress).toBeVisible();
  await expect(whiteNoiseProgress).toBeVisible();
  await expect(relaxationProgress).toBeVisible();
  await expect(asmrCard).toContainText("지원 음원을 준비하고 있어요.");
  await expect(asmrCard.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("5분 이완", { exact: true })).toBeVisible();
  await expect(breathingCard.getByRole("button", { name: "시작" })).toBeVisible();
  await expect(breathingCard.getByRole("button", { name: "멈추기" })).toBeVisible();
  await expect(whiteNoiseCard.getByRole("button", { name: "시작" })).toBeVisible();
  await expect(whiteNoiseCard.getByRole("button", { name: "멈추기" })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1024 });
  await expect(careScreen).toBeVisible();
  await expect(page.getByRole("button", { name: "완료" }).first()).toBeVisible();
  await expect(breathingCard).toBeVisible();
  await expect(whiteNoiseCard).toBeVisible();

  const [sidebarBox, headerBox] = await Promise.all([
    page.locator("aside").first().boundingBox(),
    careScreen.locator("header").boundingBox(),
  ]);
  expect(sidebarBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x + sidebarBox!.width + 64);

  await page.getByRole("button", { name: "완료" }).first().click();
  await expect(page.getByRole("button", { name: "되돌리기" }).first()).toBeVisible();

  await breathingCard.getByRole("button", { name: "시작" }).focus();
  await page.keyboard.press("Enter");
  await expect(breathingCard.getByRole("button", { name: "일시정지" })).toBeVisible();
});
