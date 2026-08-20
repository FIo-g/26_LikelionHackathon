import { expect, test } from "@playwright/test";
import { VISUAL_FIXTURE_NOW } from "@/shared/time/visual-server-clock";
import { authenticateVisualUser } from "./authenticate";
import { blockUnexpectedExternalRequests, maskVolatileVisualIdentity, mockNarrationProvider, seedVisualFixture, visualIdentity } from "./fixtures";
import { VISUAL_FRAMES } from "./manifest";

test.use({ timezoneId: "Asia/Seoul", colorScheme: "light", reducedMotion: "reduce" });

for (const frame of VISUAL_FRAMES) {
  test(frame.name, async ({ page }, testInfo) => {
    await page.setViewportSize(frame.viewport);
    await page.clock.install({ time: new Date(VISUAL_FIXTURE_NOW.getTime()) });
    await blockUnexpectedExternalRequests(page);
    await mockNarrationProvider(page);
    if (frame.fixture === "signed-out") {
      await page.context().clearCookies();
    } else {
      const identity = visualIdentity(testInfo.workerIndex, frame.name);
      await authenticateVisualUser(page, identity);
      await seedVisualFixture(frame.fixture, identity.email);
    }
    await page.goto(frame.path);
    await page.evaluate(async () => { await document.fonts.ready; });
    await maskVolatileVisualIdentity(page);
    await expect(page).toHaveScreenshot(`${frame.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
