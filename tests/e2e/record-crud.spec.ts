import { expect, test } from "@playwright/test";

test("creates, edits, and deletes a caffeine record end to end", async ({ page }) => {
  const email = `record-crud-${crypto.randomUUID()}@example.invalid`;
  const password = "Record-crud-passphrase-2026";

  await page.goto("/sign-up");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "회원가입" }).click();

  await page.goto("/onboarding/profile");
  await page.getByLabel("닉네임").fill("Record crud smoke");
  await page.getByRole("button", { name: "완료" }).click();
  await page.goto("/onboarding/sleep-goal");
  await page.getByRole("button", { name: "다음" }).click();
  await page.goto("/onboarding/habits");
  await page.getByRole("button", { name: "다음" }).click();
  await page.goto("/onboarding/connect");
  await page.getByRole("button", { name: "연결하기" }).click();

  await page.goto("/record/caffeine");
  await page.getByLabel("브랜드").fill("CRUD Brand");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("제품명").fill("CRUD Product");
  await page.getByLabel("카페인(mg)").fill("120");
  await page.getByLabel("마신 시각").fill("2026-08-19T09:00");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "카페인 저장" }).click();

  await page.goto("/record");
  const caffeineCard = page.locator("section", { has: page.getByRole("heading", { name: "카페인", level: 2 }) });
  await expect(caffeineCard.getByText("완료")).toBeVisible();
  await expect(caffeineCard.getByText(/마지막:/)).toBeVisible();

  await caffeineCard.getByRole("link", { name: "수정" }).click();
  await expect(page.getByLabel("브랜드")).toHaveValue("CRUD Brand");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByLabel("제품명")).toHaveValue("CRUD Product");
  await page.getByLabel("제품명").fill("CRUD Product Updated");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "카페인 저장" }).click();

  await page.goto("/record");
  const updatedCard = page.locator("section", { has: page.getByRole("heading", { name: "카페인", level: 2 }) });
  page.once("dialog", (dialog) => dialog.accept());
  await updatedCard.getByRole("button", { name: "삭제" }).click();
  await expect(updatedCard.getByText("미입력")).toBeVisible();
});

test("protects record hub without session", async ({ page }) => {
  await page.goto("/record");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("protects every intake flow without session", async ({ page }) => {
  await page.goto("/record/caffeine");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.goto("/record/alcohol");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.goto("/record/meal-health");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.goto("/record/sleep-phone");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});
