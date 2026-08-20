import { expect, type Page } from "@playwright/test";

export const authenticateVisualUser = async (page: Page, identity: Readonly<{ email: string; password: string }>): Promise<void> => {
  const response = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Visual User", email: identity.email, password: identity.password },
  });
  expect(response.ok()).toBe(true);
};
