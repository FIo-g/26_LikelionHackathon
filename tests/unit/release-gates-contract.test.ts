import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("release gate workflows", () => {
  it("uses pinned local CLIs and applies migration history to empty provider databases", async () => {
    const [ci, quality, migrate, release] = await Promise.all([
      readFile(".github/workflows/ci.yml", "utf8"),
      readFile(".github/workflows/quality.yml", "utf8"),
      readFile(".github/workflows/migrate-release.yml", "utf8"),
      readFile(".github/workflows/release-preview.yml", "utf8"),
    ]);

    expect(`${ci}\n${quality}`).not.toContain("auth@latest");
    expect(`${ci}\n${quality}`).toContain("npm exec -- auth generate");
    expect(release).toContain("npm exec -- vercel --version");
    expect(ci).toContain("npm run db:migrate:sqlite");
    expect(ci.match(/prisma migrate deploy/g)).toHaveLength(2);
    expect(ci.match(/npm run verify:migrations/g)).toHaveLength(3);
    expect(migrate).toContain("prisma migrate deploy");
    expect(migrate).toContain("prisma migrate status");
    expect(ci).not.toContain("prisma db push");
  });

  it("never skips visual comparison when baselines are absent and shares authenticated cleanup", async () => {
    const [ci, visual, fixtures] = await Promise.all([
      readFile(".github/workflows/ci.yml", "utf8"),
      readFile("tests/visual/runtime-frames.spec.ts", "utf8"),
      readFile("tests/e2e/fixtures.ts", "utf8"),
    ]);

    expect(ci).not.toContain("hashFiles(");
    expect(ci).toContain("npm run test:visual");
    expect(visual).toContain('context.request.delete("/__e2e/cleanup"');
    expect(fixtures).toContain('context.request.delete("/__e2e/cleanup"');
  });

  it("generates the auth schema with database-backed rate limiting enabled", async () => {
    const verifier = await readFile("scripts/verify-auth-schema.ts", "utf8");

    expect(verifier).toContain('AUTH_RATE_LIMIT_ENABLED: "true"');
  });
});

describe("production smoke contract", () => {
  it("waits for and parses the versioned export, reauthenticates, and cleans up independently", async () => {
    const smoke = await readFile("tests/e2e/production-smoke.spec.ts", "utf8");

    expect(smoke).toContain('page.waitForEvent("download")');
    expect(smoke).toContain("Promise.all");
    expect(smoke).toContain("JSON.parse");
    expect(smoke).toContain("schemaVersion: 1");
    expect(smoke).toContain('/api/auth/sign-out');
    expect(smoke).toContain('page.goto("/sign-in")');
    expect(smoke).toContain("test.afterEach");
    expect(smoke).toContain("browser.newContext");
    expect(smoke).not.toContain("if (await page.getByRole");
  });
});
