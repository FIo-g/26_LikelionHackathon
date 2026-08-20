import { expect, setupE2eUser, test } from "./fixtures";

const futureLocalTime = (daysFromNow: number, hour: number): string => {
  const startsAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, "0")}-${String(startsAt.getDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;
};

test("protects today route without session", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("shows accepted plan-day cutoffs instead of the goal fallback", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/plan");
  await page.getByLabel("일정 이름").fill("이른 아침 이동");
  await page.getByLabel("일정 유형").fill("여행");
  await page.getByLabel("시작 시간").fill(futureLocalTime(1, 9));
  await page.getByLabel("희망 기상 시간").fill(futureLocalTime(1, 5));
  await page.getByRole("button", { name: "주요 일정 추가" }).click();
  await page.getByRole("button", { name: "계획에 반영" }).click();
  await page.getByRole("button", { name: "변경 확인 및 반영" }).click();

  await page.goto("/today");
  const caffeineStep = page.getByRole("listitem").filter({ hasText: "카페인 마감" });
  await expect(caffeineStep).toContainText("목표 시각 15:15");
  await expect(caffeineStep).not.toContainText("목표 시각 17:00");
});
