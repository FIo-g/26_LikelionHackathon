import { createHash } from "node:crypto";

import { expect, test as base, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";

import { e2eIdentity, type E2eIdentity } from "@/shared/auth/e2e-identity";

const namespaceFor = (testInfo: TestInfo): string => {
  const digest = createHash("sha256").update(testInfo.titlePath.join("\0")).digest("hex").slice(0, 12);
  return `test-${digest}`;
};

export const e2eTestIdentity = (testInfo: TestInfo) => e2eIdentity({
  workerIndex: testInfo.workerIndex,
  namespace: namespaceFor(testInfo),
});

const seededCleanupIdentities = new Set<string>();

const cleanupKey = (testInfo: TestInfo): string => {
  const identity = e2eTestIdentity(testInfo);
  return `${testInfo.workerIndex}:${identity.namespace}`;
};

export const takeSeededE2eIdentityForCleanup = (testInfo: TestInfo): E2eIdentity | null => {
  const key = cleanupKey(testInfo);
  if (!seededCleanupIdentities.delete(key)) return null;
  return e2eTestIdentity(testInfo);
};

export const setupE2eUser = async (
  request: APIRequestContext,
  testInfo: TestInfo,
  options: Readonly<{ seedPlan?: boolean }> = {},
): Promise<void> => {
  const identity = e2eTestIdentity(testInfo);
  const response = await request.post(`/__e2e/setup${options.seedPlan ? "?seedPlan=1" : ""}`, {
    data: { workerIndex: testInfo.workerIndex, namespace: identity.namespace },
  });
  expect(response.ok()).toBe(true);
  seededCleanupIdentities.add(cleanupKey(testInfo));
};

export const test = base.extend<{ cleanupE2eIdentity: void }>({
  cleanupE2eIdentity: [async ({ context }, use, testInfo) => {
    await use();
    const identity = takeSeededE2eIdentityForCleanup(testInfo);
    if (!identity) return;
    const response = await context.request.delete("/__e2e/cleanup", {
      data: { workerIndex: testInfo.workerIndex, namespace: identity.namespace },
    });
    expect(response.ok()).toBe(true);
  }, { auto: true }],
});

type LocatorScope = Page | Locator;

export const majorEventForm = (page: Page) => page.locator("#major-event-form");

export const visibleByLabel = (scope: LocatorScope, label: string) => scope.getByLabel(label, { exact: true });

export const visibleText = (scope: LocatorScope, text: string) => scope.getByText(text, { exact: true }).filter({ visible: true });

export const visibleButton = (scope: LocatorScope, name: string) => scope.getByRole("button", { name }).filter({ visible: true });

export { expect };
