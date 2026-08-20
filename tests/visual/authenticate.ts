import { expect, type Page } from "@playwright/test";

export const authenticateVisualUser = async (
  page: Page,
  identity: Readonly<{ workerIndex: number; namespace: string }>,
): Promise<void> => {
  const response = await page.request.post("/__e2e/setup", {
    data: { workerIndex: identity.workerIndex, namespace: identity.namespace },
  });
  expect(response.ok()).toBe(true);
};
