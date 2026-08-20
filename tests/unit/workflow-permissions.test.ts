import { readFile } from "node:fs/promises";

import { expect, it } from "vitest";

it("keeps every current workflow at contents-read permissions", async () => {
  const [quality, release] = await Promise.all([
    readFile(".github/workflows/quality.yml", "utf8"),
    readFile(".github/workflows/release-preview.yml", "utf8"),
  ]);

  expect(quality).toContain("permissions:\n  contents: read");
  expect(release).toContain("permissions:\n  contents: read");
  expect(release).not.toContain("deployments: write");
});
