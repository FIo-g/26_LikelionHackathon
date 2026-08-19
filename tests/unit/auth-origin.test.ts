import { describe, expect, it } from "vitest";
import { resolveAuthOrigin } from "@/shared/auth/auth-origin";

describe("resolveAuthOrigin", () => {
  it("resolves Vercel preview origin", () => {
    expect(resolveAuthOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "sleep-main-team.vercel.app",
    })).toEqual({
      baseURL: "https://sleep-main-team.vercel.app",
      trustedOrigins: ["https://sleep-main-team.vercel.app"],
    });
  });

  it("uses BETTER_AUTH_URL in production", () => {
    expect(resolveAuthOrigin({
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://sleep.example.com",
    }).baseURL).toBe("https://sleep.example.com");
  });

  it("uses local dev URL in development", () => {
    expect(resolveAuthOrigin({
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
    }).baseURL).toBe("http://127.0.0.1:3000");
  });

  it("throws on wildcard preview host", () => {
    expect(() => resolveAuthOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "*.vercel.app",
    })).toThrow("INVALID_AUTH_ORIGIN");
  });
});

