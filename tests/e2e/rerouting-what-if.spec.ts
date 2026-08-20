import { expect, setupE2eUser, test, visibleText } from "./fixtures";

const toDateTimeLocal = (instant: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
};

test("creates reroute advice only after saving a cutoff-crossing caffeine record", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo, { seedPlan: true });
  await page.goto("/plan");
  const planStrip = page.getByTestId("plan-strip");
  const snapshotDays = async () => planStrip.getByTestId("plan-day").evaluateAll((items) => items.map((item) => ({
    localDate: item.getAttribute("data-local-date") ?? "",
    cutoffAt: item.getAttribute("data-cutoff-at") ?? "",
    wakeAt: item.getAttribute("data-wake-at") ?? "",
    bedAt: item.getAttribute("data-bed-at") ?? "",
    text: item.textContent ?? "",
  })));
  const beforeDays = await snapshotDays();
  const beforeCapturedAt = Date.now();
  const pastDays = (days: typeof beforeDays) => days.filter((day) => new Date(day.bedAt).getTime() < beforeCapturedAt);
  const futureDays = (days: typeof beforeDays) => days.filter((day) => new Date(day.bedAt).getTime() > beforeCapturedAt);
  const beforePastDays = pastDays(beforeDays);
  const beforeFutureDays = futureDays(beforeDays);
  expect(beforePastDays).toHaveLength(1);
  expect(beforeFutureDays).toHaveLength(2);
  const triggerDay = beforeDays.find((day) => (
    new Date(day.cutoffAt).getTime() < Date.now()
      && Date.now() < new Date(day.wakeAt).getTime()
      && Date.now() < new Date(day.bedAt).getTime()
  ));
  if (!triggerDay) throw new Error("Seeded plan did not include an active cutoff window");
  const caffeineAt = toDateTimeLocal(new Date(Math.max(
    new Date(triggerDay.cutoffAt).getTime() + 60_000,
    Math.min(Date.now() - 60_000, new Date(triggerDay.wakeAt).getTime() - 60_000),
  )));

  await page.goto("/plan");
  await expect(page.getByText("계획 조정 제안")).not.toBeVisible();
  await page.goto(`/record/caffeine?step=confirm&brand=%ED%85%8C%EC%8A%A4%ED%8A%B8&product=%EC%BB%A4%ED%94%BC&caffeineMg=120&consumedAt=${encodeURIComponent(caffeineAt)}`);
  await page.getByRole("button", { name: "카페인 저장" }).click();
  await expect(page).toHaveURL(/\/record$/);
  await page.goto("/plan");
  await expect(visibleText(page, "계획 조정 제안")).toBeVisible();
  await page.getByRole("button", { name: "계획에 반영" }).click();
  const confirmDialog = page.getByRole("dialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "취소", exact: true }).click();
  expect(await snapshotDays()).toEqual(beforeDays);
  await page.getByRole("button", { name: "계획에 반영" }).click();
  await page.getByRole("button", { name: "변경 확인 및 반영" }).click();
  await expect(confirmDialog).toHaveCount(0);
  await expect.poll(async () => futureDays(await snapshotDays())).not.toEqual(beforeFutureDays);
  const afterDays = await snapshotDays();
  expect(pastDays(afterDays)).toEqual(beforePastDays);
  expect(futureDays(afterDays)).not.toEqual(beforeFutureDays);
});
