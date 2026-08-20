import { expect, setupE2eUser, test } from "./fixtures";

test("protects record hub without session", async ({ page }) => {
  await page.goto("/record");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("protects every intake flow without session", async ({ page }) => {
  await page.goto("/record/caffeine");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();

  await page.goto("/record/alcohol");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();

  await page.goto("/record/meal-health");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();

  await page.goto("/record/sleep-phone");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("shows distinct record cards and routes the quick-record CTA to a live form", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/record");

  await expect(page.getByRole("link", { name: "빠른 기록 시작" })).toHaveAttribute("href", "/record/caffeine?step=brand");

  const expectedRoutes = [
    ["카페인", "/record/caffeine?step=brand"],
    ["알코올", "/record/alcohol?step=type"],
    ["식사", "/record/meal-health?step=meal&focus=meal"],
    ["운동", "/record/meal-health?step=exercise-and-wellness&focus=exercise"],
    ["휴대폰", "/record/sleep-phone?step=phone&focus=phone"],
    ["어젯밤 수면", "/record/sleep-phone?step=sleep&focus=sleep"],
  ] as const;

  for (const [name, href] of expectedRoutes) {
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name }) });
    await expect(card.getByRole("link", { name: "추가" })).toHaveAttribute("href", href);
  }

  await page.getByRole("link", { name: "빠른 기록 시작" }).click();
  await expect(page.getByRole("heading", { name: "어디서 마셨나요?" })).toBeVisible();
});

test("creates, edits, and deletes a caffeine record through the visible intake controls", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);

  await page.goto("/record/caffeine");
  await page.getByRole("button", { name: /스타벅스/ }).click();
  await expect(page.getByLabel("브랜드", { exact: true })).toHaveValue("스타벅스");
  await page.getByRole("button", { name: "메뉴 선택하기" }).click();
  await page.getByRole("button", { name: /아메리카노/ }).click();
  await page.getByLabel("카페인(mg)", { exact: true }).fill("150");
  await page.getByLabel("마신 시각", { exact: true }).fill("2026-08-20T12:30");
  await page.getByRole("button", { name: "수치 확인하기" }).click();
  await page.getByRole("button", { name: "카페인 저장" }).click();

  await expect(page).toHaveURL(/\/record$/);
  const caffeineCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "카페인" }) });
  await expect(caffeineCard.getByText("완료", { exact: true })).toBeVisible();

  await caffeineCard.getByRole("link", { name: "수정" }).click();
  await expect(page.getByRole("heading", { name: "어디서 마셨나요?" })).toBeVisible();
  await expect(page.getByLabel("브랜드", { exact: true })).toHaveValue("스타벅스");
  await page.getByLabel("브랜드", { exact: true }).fill("동네 카페");
  await page.getByRole("button", { name: "메뉴 선택하기" }).click();
  await page.getByRole("button", { name: "수치 확인하기" }).click();
  await page.getByRole("button", { name: "카페인 저장" }).click();

  await expect(page).toHaveURL(/\/record$/);
  const updatedCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "카페인" }) });
  page.once("dialog", (dialog) => dialog.accept());
  await updatedCard.getByRole("button", { name: "삭제" }).click();
  await expect(updatedCard.getByText("미입력", { exact: true })).toBeVisible();
});
