import { describe, expect, it } from "vitest";

import { calculateReadiness } from "@/modules/analysis/domain/calculate-readiness";

describe("calculateReadiness", () => {
  it("reweights present components instead of treating missing values as zero", () => {
    const result = calculateReadiness({
      sleepDuration: 80,
      regularity: 60,
      caffeine: null,
      phone: null,
      mealExercise: null,
    });

    expect(result.score).toBe(72);
    expect(result.missingFields).toEqual(["caffeine", "phone", "mealExercise"]);
  });

  it("returns null when sleep duration is missing", () => {
    const result = calculateReadiness({
      sleepDuration: null,
      regularity: 60,
      caffeine: 80,
      phone: 70,
      mealExercise: 90,
    });

    expect(result.score).toBeNull();
    expect(result.missingFields).toContain("sleepDuration");
  });
});
