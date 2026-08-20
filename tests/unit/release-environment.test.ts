import { describe, expect, it } from "vitest";

import {
  assertReleaseEnvironment,
  isReleaseValidationEnabled,
} from "../../scripts/validate-release-environment.mjs";

const validEnvironment = {
  DATABASE_URL: "postgresql://runtime:secret@pooled.example.invalid/planner?sslmode=require",
  BETTER_AUTH_SECRET: "a-secret-with-more-than-thirty-two-bytes",
  BETTER_AUTH_URL: "https://preview.example.vercel.app",
  AUTH_RATE_LIMIT_ENABLED: "true",
  OPENAI_API_KEY: "sk-private-value-that-must-not-appear",
  OPENAI_MODEL: "gpt-5.6-terra",
};

describe("release environment validation", () => {
  it("accepts only the configured runtime contract", () => {
    expect(() => assertReleaseEnvironment(validEnvironment)).not.toThrow();
  });

  it("fails closed without including supplied values", () => {
    expect(() => assertReleaseEnvironment({ ...validEnvironment, OPENAI_MODEL: "other-model" })).toThrow("OPENAI_MODEL");
    expect(() => assertReleaseEnvironment({ ...validEnvironment, OPENAI_API_KEY: "secret-value-never-logged" })).not.toThrow();
    expect(() => assertReleaseEnvironment({ ...validEnvironment, OPENAI_API_KEY: "" })).toThrow("OPENAI_API_KEY");
    try {
      assertReleaseEnvironment({ ...validEnvironment, BETTER_AUTH_SECRET: "short" });
    } catch (error) {
      expect(String(error)).not.toContain("short");
    }
  });

  it("runs only for Vercel or an explicit scoped release invocation", () => {
    expect(isReleaseValidationEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(isReleaseValidationEnabled({ VERCEL: "1" })).toBe(true);
    expect(isReleaseValidationEnabled({ ADAPTIVE_SLEEP_RELEASE_VALIDATION: "1" })).toBe(true);
  });
});
