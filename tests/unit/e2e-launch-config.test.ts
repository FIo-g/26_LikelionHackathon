import { afterEach, describe, expect, it, vi } from "vitest";
import playwrightConfig from "../../playwright.config";
import { buildE2eServerArguments } from "../../scripts/e2e-server-arguments.mjs";
import { resolveE2eLaunchEnvironment } from "../../scripts/e2e-launch-config.mjs";

const prisma = vi.hoisted(() => new Proxy({}, {
  get: (_target, model: string) => ({
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({ id: model }),
    create: vi.fn().mockResolvedValue({ id: `${model}-id` }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  }),
}));

vi.mock("@/shared/db/prisma", () => ({ getPrismaClient: () => prisma }));

import { POST as setupE2eUser } from "@/app/%5F_e2e/setup/route";

const dedicatedUrl = "file:./.tmp/adaptive-sleep-e2e.sqlite";

describe("E2E launcher isolation", () => {
  afterEach(() => {
    delete process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE;
    delete process.env.DATABASE_URL;
  });

  it("refuses to start when Vercel marks the process as a shared deployment", () => {
    expect(() => resolveE2eLaunchEnvironment({
      VERCEL_ENV: "preview",
      ADAPTIVE_SLEEP_E2E_DATABASE_URL: dedicatedUrl,
    })).toThrow("E2E_LAUNCH_FORBIDDEN_ON_VERCEL");
    expect(() => resolveE2eLaunchEnvironment({
      VERCEL_ENV: "",
      ADAPTIVE_SLEEP_E2E_DATABASE_URL: dedicatedUrl,
    })).toThrow("E2E_LAUNCH_FORBIDDEN_ON_VERCEL");
  });

  it("requires a dedicated E2E database URL instead of falling back to DATABASE_URL", () => {
    expect(() => resolveE2eLaunchEnvironment({ DATABASE_URL: "file:./dev.sqlite" })).toThrow("E2E_DATABASE_URL_REQUIRED");
  });

  it("rejects ordinary, shared, development, and production database URLs", () => {
    for (const databaseUrl of ["file:./dev.sqlite", "file:./shared-e2e.sqlite", "file:./production-e2e.sqlite", "postgresql://db/e2e"]) {
      expect(() => resolveE2eLaunchEnvironment({ ADAPTIVE_SLEEP_E2E_DATABASE_URL: databaseUrl })).toThrow("INVALID_E2E_DATABASE_URL");
    }
  });

  it("accepts only the explicit local PostgreSQL E2E schema used by the provider-parity browser job", () => {
    const postgresE2eUrl = "postgresql://planner:planner@127.0.0.1:5432/planner_test?schema=e2e_browser";

    expect(resolveE2eLaunchEnvironment({ ADAPTIVE_SLEEP_E2E_DATABASE_URL: postgresE2eUrl })).toMatchObject({
      DATABASE_URL: postgresE2eUrl,
      NODE_ENV: "test",
      ADAPTIVE_SLEEP_E2E_TEST_MODE: "1",
    });
  });

  it("builds the child environment only from an explicit dedicated E2E database URL", () => {
    expect(resolveE2eLaunchEnvironment({
      PATH: "/usr/bin",
      DATABASE_URL: "file:./ordinary.sqlite",
      ADAPTIVE_SLEEP_E2E_DATABASE_URL: dedicatedUrl,
    })).toEqual({
      PATH: "/usr/bin",
      NODE_ENV: "test",
      ADAPTIVE_SLEEP_E2E_TEST_MODE: "1",
      DATABASE_URL: dedicatedUrl,
      BETTER_AUTH_SECRET: "adaptive-sleep-e2e-test-secret-2026-only",
    });
    expect(playwrightConfig.webServer).toMatchObject({ command: "node scripts/start-e2e-server.mjs", reuseExistingServer: false });
  });

  it("keeps visual clock authority out of the child environment after accepting a dedicated visual E2E database", () => {
    const environment = resolveE2eLaunchEnvironment({
      ADAPTIVE_SLEEP_E2E_DATABASE_URL: dedicatedUrl,
      VISUAL_TEST: "1",
    });

    expect(environment).toMatchObject({
      DATABASE_URL: dedicatedUrl,
      VISUAL_TEST: "1",
    });
    expect(environment).not.toHaveProperty("ADAPTIVE_SLEEP_VISUAL_FIXED_NOW");
    expect(environment).not.toHaveProperty("ADAPTIVE_SLEEP_VISUAL_ISOLATION_MARKER");
  });

  it("preloads the fixed clock capability for the validated visual child only", () => {
    expect(buildE2eServerArguments(false)).not.toContain("./scripts/install-visual-clock-capability.mjs");
    expect(buildE2eServerArguments(true)).toEqual([
      "--import",
      "./scripts/install-visual-clock-capability.mjs",
      "./node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ]);
  });

  it("uses a unique authenticated E2E identity for each worker namespace", async () => {
    process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE = "1";
    process.env.DATABASE_URL = dedicatedUrl;
    delete process.env.VERCEL_ENV;

    const first = await setupE2eUser(new Request("http://localhost/__e2e/setup", {
      method: "POST",
      body: JSON.stringify({ workerIndex: 0, namespace: "auth" }),
      headers: { "content-type": "application/json" },
    }));
    const second = await setupE2eUser(new Request("http://localhost/__e2e/setup", {
      method: "POST",
      body: JSON.stringify({ workerIndex: 1, namespace: "auth" }),
      headers: { "content-type": "application/json" },
    }));

    expect(first.headers.get("set-cookie")).not.toEqual(second.headers.get("set-cookie"));
  });
});
