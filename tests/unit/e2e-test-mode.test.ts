import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import * as setupRoute from "@/app/%5F_e2e/setup/route";
import { isIsolatedE2eTestMode } from "@/shared/auth/e2e-test-mode";

afterEach(() => vi.unstubAllEnvs());

describe("isolated E2E test mode", () => {
  it("escapes the leading underscore so Next exposes the stable /__e2e URL", () => {
    expect(existsSync("src/app/%5F_e2e/setup/route.ts")).toBe(true);
    expect(existsSync("src/app/%5F_e2e/cleanup/route.ts")).toBe(true);
    expect(existsSync("src/app/__e2e")).toBe(false);
  });

  it("allows a Next development server only with the flag and a dedicated E2E database", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "1");
    vi.stubEnv("DATABASE_URL", "file:./.tmp/task8-browser-e2e.sqlite");
    delete process.env.VERCEL_ENV;

    expect(isIsolatedE2eTestMode()).toBe(true);
  });

  it("requires the opt-in flag and exposes only a POST setup endpoint", async () => {
    vi.stubEnv("DATABASE_URL", "file:./.tmp/task8-browser-e2e.sqlite");
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "");
    delete process.env.VERCEL_ENV;
    expect(isIsolatedE2eTestMode()).toBe(false);
    expect("GET" in setupRoute).toBe(false);
    const post = (setupRoute as { POST?: (request: Request) => Promise<Response> }).POST;
    expect(post).toBeTypeOf("function");
    await expect(post?.(new Request("http://localhost/__e2e/setup", { method: "POST" }))).resolves.toMatchObject({ status: 404 });
  });

  it.each([
    "file:./dev.sqlite",
    "file:./.tmp/shared-e2e.sqlite",
    "file:./.tmp/production-e2e.sqlite",
    "postgresql://planner:planner@remote.example/planner_test?schema=e2e_browser",
  ])("rejects a non-dedicated runtime database: %s", (databaseUrl) => {
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "1");
    vi.stubEnv("DATABASE_URL", databaseUrl);
    delete process.env.VERCEL_ENV;

    expect(isIsolatedE2eTestMode()).toBe(false);
  });

  it.each(["", "preview", "production"])("rejects any Vercel runtime marker: %s", (vercelEnv) => {
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "1");
    vi.stubEnv("DATABASE_URL", "file:./.tmp/task8-browser-e2e.sqlite");
    vi.stubEnv("VERCEL_ENV", vercelEnv);

    expect(isIsolatedE2eTestMode()).toBe(false);
  });
});
