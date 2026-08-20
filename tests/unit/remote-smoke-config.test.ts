import { readFile } from "node:fs/promises";

import { expect, it } from "vitest";

it("keeps the production smoke runner remote-only", async () => {
  const config = await readFile("playwright.remote.config.ts", "utf8");

  expect(config).toContain("process.env.BASE_URL");
  expect(config).toContain("name: \"preview-smoke\"");
  expect(config).not.toContain("webServer");
});
