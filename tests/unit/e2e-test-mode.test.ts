import { afterEach, describe, expect, it, vi } from "vitest";
import * as setupRoute from "@/app/__e2e/setup/route";
import { isIsolatedE2eTestMode } from "@/shared/auth/e2e-test-mode";

afterEach(() => vi.unstubAllEnvs());

describe("isolated E2E test mode", () => {
  it("stays disabled outside an isolated test process even when the opt-in flag is supplied", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "1");
    expect(isIsolatedE2eTestMode()).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    expect(isIsolatedE2eTestMode()).toBe(false);
  });

  it("requires the opt-in flag in test mode and exposes only a POST setup endpoint", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "");
    expect(isIsolatedE2eTestMode()).toBe(false);
    expect("GET" in setupRoute).toBe(false);
    const post = (setupRoute as { POST?: (request: Request) => Promise<Response> }).POST;
    expect(post).toBeTypeOf("function");
    await expect(post?.(new Request("http://localhost/__e2e/setup", { method: "POST" }))).resolves.toMatchObject({ status: 404 });
  });

  it("enables the isolated test predicate only for the explicit test runner environment", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "1");
    vi.stubEnv("VERCEL_ENV", "");

    expect(isIsolatedE2eTestMode()).toBe(true);
  });
});
