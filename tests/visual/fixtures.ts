import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { seedVisualFixtureData } from "../../scripts/seed-visual-fixtures";
import { e2eIdentity } from "../../src/shared/auth/e2e-identity";
import type { VisualFixture } from "./manifest";

export const visualIdentity = (workerIndex: number, frameName: string) => {
  const namespace = `visual-${createHash("sha256").update(frameName).digest("hex").slice(0, 12)}`;
  const identity = e2eIdentity({ workerIndex, namespace });
  return {
    ...identity,
    workerIndex,
    password: "Visual-test-only-2026!",
  } as const;
};

export const visualSnapshotEmail = (): string => "visual-account@example.invalid";

export const maskVolatileVisualIdentity = async (page: Page): Promise<void> => {
  await page.locator('input[aria-label="로그인 이메일"]').evaluateAll((inputs, maskedEmail) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    for (const input of inputs) descriptor?.set?.call(input, maskedEmail);
  }, visualSnapshotEmail());
};

export const seedVisualFixture = async (fixture: VisualFixture, email: string): Promise<void> => {
  if (fixture === "signed-out") return;
  await seedVisualFixtureData(fixture, email);
};

export const mockNarrationProvider = async (page: Page): Promise<void> => {
  await page.route("https://api.openai.com/**", async (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ output_text: "" }),
  }));
};

export const blockUnexpectedExternalRequests = async (page: Page): Promise<void> => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost", "::1"].includes(url.hostname)) return route.continue();
    return route.abort("blockedbyclient");
  });
};
