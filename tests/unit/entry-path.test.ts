import { describe, expect, it } from "vitest";
import { resolveEntryPath, safeReturnTo } from "@/shared/auth/entry-path";

describe("entry-path", () => {
  it.each([
    [{ userId: null, onboardingCompletedAt: null }, "/sign-in"],
    [{ userId: "u1", onboardingCompletedAt: null }, "/onboarding/connect"],
    [{ userId: "u1", onboardingCompletedAt: new Date("2026-08-19T00:00:00Z") }, "/today"],
  ] as const)("resolves entry route", (context, expected) => {
    expect(resolveEntryPath(context)).toBe(expected);
  });

  it("preserves same-origin returnTo path", () => {
    expect(safeReturnTo("/record/caffeine?step=brand")).toBe("/record/caffeine?step=brand");
  });

  it("rejects absolute attacker URL", () => {
    expect(safeReturnTo("https://attacker.example/steal")).toBe("/");
  });

  it("rejects protocol-relative attacker URL", () => {
    expect(safeReturnTo("//attacker.example/steal")).toBe("/");
  });
});
