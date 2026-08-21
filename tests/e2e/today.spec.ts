import { expect, majorEventForm, setupE2eUser, test, visibleButton, visibleByLabel } from "./fixtures";

const futureLocalTime = (daysFromNow: number, hour: number): string => {
  const startsAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, "0")}-${String(startsAt.getDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;
};

test("protects today route without session", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("keeps the brand separate from the active Today navigation item", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/today");

  const brand = page.getByRole("link", { name: "SLEEP LOOP" });
  const desktopNavigation = page.getByRole("navigation", { name: "데스크톱 주요 메뉴" });
  const todayNavigationItem = desktopNavigation.getByRole("link", { name: "Today" });

  await expect(brand).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(todayNavigationItem).toHaveCSS("background-color", "rgb(95, 52, 111)");
});

test("shows accepted plan-day cutoffs instead of the goal fallback", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/plan");
  const form = majorEventForm(page);
  await visibleByLabel(form, "일정 이름").fill("이른 아침 이동");
  await visibleByLabel(form, "일정 유형").fill("여행");
  await visibleByLabel(form, "시작 시간").fill(futureLocalTime(1, 9));
  await visibleByLabel(form, "원하는 기상 시간 (선택)").fill(futureLocalTime(1, 5));
  await form.getByRole("button", { name: "주요 일정 추가" }).click();
  await visibleButton(page, "계획에 반영").click();
  await page.getByRole("button", { name: "변경 확인 및 반영" }).click();

  await page.goto("/today");
  const caffeineStep = page.getByRole("listitem").filter({ hasText: "카페인 마감" });
  await expect(caffeineStep).toContainText("목표 시각 13:15");
  await expect(caffeineStep).not.toContainText("목표 시각 17:00");
});
