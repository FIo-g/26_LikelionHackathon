import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = ["/sign-in"];
const authenticatedRoutes = ["/onboarding/connect", "/onboarding/sleep-goal", "/onboarding/habits", "/onboarding/profile", "/today", "/record", "/plan", "/analyze", "/care", "/account"];

test.use({ timezoneId: "Asia/Seoul", colorScheme: "light" });

for (const path of publicRoutes) {
  test(`has no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  });
}

for (const path of authenticatedRoutes) {
  test(`has no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.request.post("/__e2e/setup?seedPlan=1");
    await page.goto(path);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  });
}

test("supports keyboard focus, dialog escape, and focus return", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/__e2e/setup");
  await page.goto("/account");
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.querySelector(":focus-visible") !== null)).toBe(true);
  const trigger = page.getByRole("button", { name: "계정 삭제" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "계정 삭제 확인" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "계정 삭제 확인" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("keeps care tool controls usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/__e2e/setup?seedPlan=1");
  await page.goto("/care");
  await page.getByRole("button", { name: "시작" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "멈추기" }).first()).toBeVisible();
});
