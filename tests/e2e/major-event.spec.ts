import { expect, majorEventForm, setupE2eUser, test, visibleButton, visibleByLabel, visibleText } from "./fixtures";

test("protects the Plan screen without a session", async ({ page }) => {
  await page.goto("/plan");

  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

const futureLocalTime = (daysFromNow: number): string => {
  const startsAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, "0")}-${String(startsAt.getDate()).padStart(2, "0")}T09:00`;
};

test("keeps a saved major-event title visible after a full Plan reload", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);

  await page.goto("/plan");
  const form = majorEventForm(page);
  await visibleByLabel(form, "일정 이름").fill("졸업 발표 리허설");
  await visibleByLabel(form, "일정 유형").fill("발표");
  await visibleByLabel(form, "시작 시간").fill(futureLocalTime(7));
  await form.getByRole("button", { name: "주요 일정 추가" }).click();

  await expect(visibleText(page, "졸업 발표 리허설")).toBeVisible();
  await page.reload();
  await expect(visibleText(page, "졸업 발표 리허설")).toBeVisible();
});

test("accepts generated advice and separately dismisses a later generated proposal", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);

  await page.goto("/plan");
  const form = majorEventForm(page);
  await visibleByLabel(form, "일정 이름").fill("아침 비행");
  await visibleByLabel(form, "일정 유형").fill("여행");
  await visibleByLabel(form, "시작 시간").fill(futureLocalTime(7));
  await form.getByRole("button", { name: "주요 일정 추가" }).click();

  await expect(visibleText(page, "수면 조정 제안")).toBeVisible();
  await expect(visibleText(page, "이 제안은 아직 계획에 반영되지 않았어요.")).toBeVisible();
  await visibleButton(page, "계획에 반영").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /일의 계획이 변경됩니다/ })).toBeVisible();
  await page.getByRole("button", { name: "변경 확인 및 반영" }).click();
  await expect(page.getByRole("heading", { name: "반영된 수면 계획" })).toBeVisible();
  await expect(visibleText(page, "이 제안은 아직 계획에 반영되지 않았어요.")).not.toBeVisible();

  await visibleByLabel(form, "일정 이름").fill("아침 발표");
  await visibleByLabel(form, "일정 유형").fill("발표");
  await visibleByLabel(form, "시작 시간").fill(futureLocalTime(8));
  await form.getByRole("button", { name: "주요 일정 추가" }).click();
  await expect(visibleText(page, "이 제안은 아직 계획에 반영되지 않았어요.")).toBeVisible();
  await visibleButton(page, "제안 닫기").click();
  await expect(page.getByRole("status").filter({ hasText: "제안을 닫았습니다." })).toHaveText("제안을 닫았습니다.");
});
