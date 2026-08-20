import { expect, test } from "@playwright/test";
import { VISUAL_FIXTURE_NOW } from "@/shared/time/visual-server-clock";
import { authenticateVisualUser } from "./authenticate";
import { blockUnexpectedExternalRequests, maskVolatileVisualIdentity, mockNarrationProvider, seedVisualFixture, visualIdentity } from "./fixtures";
import { readdir } from "node:fs/promises";
import { VISUAL_FRAMES, visualBaselineNames } from "./manifest";

test.use({ timezoneId: "Asia/Seoul", colorScheme: "light", contextOptions: { reducedMotion: "reduce" } });

test.afterEach(async ({ context }, testInfo) => {
  const frame = VISUAL_FRAMES.find(({ name }) => name === testInfo.title);
  if (!frame || frame.fixture === "signed-out") return;
  const identity = visualIdentity(testInfo.workerIndex, frame.name);
  const response = await context.request.delete("/__e2e/cleanup", {
    data: { workerIndex: identity.workerIndex, namespace: identity.namespace },
  });
  expect(response.ok()).toBe(true);
});

test.beforeAll(async () => {
  if (process.env.ADAPTIVE_SLEEP_UPDATE_VISUAL_BASELINES === "1") return;
  const actual = (await readdir("tests/visual/__screenshots__/visual"))
    .filter((name) => name.endsWith(".png"))
    .sort();
  expect(actual).toEqual(visualBaselineNames());
});

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
