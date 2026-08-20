import { describe, expect, it } from "vitest";

import { calculateReadiness } from "@/modules/analysis/domain/calculate-readiness";
import { calculateAnalysis } from "@/modules/analysis/domain/provisional-v1";
import { READINESS_FIELD_ORDER } from "@/modules/analysis/domain/types";

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

  it("returns a readiness score when only regularity is missing", () => {
    expect(calculateReadiness({
      sleepDuration: 80,
      regularity: null,
      caffeine: 60,
      phone: 70,
      mealExercise: 90,
    })).toEqual({
      score: 75,
      missingFields: ["regularity"],
    });
  });

  it("reports missing components in the shared semantic order", () => {
    const result = calculateReadiness({
      sleepDuration: 80,
      regularity: null,
      caffeine: null,
      phone: 70,
      mealExercise: null,
    });

    expect(READINESS_FIELD_ORDER).toEqual([
      "sleepDuration",
      "regularity",
      "caffeine",
      "phone",
      "mealExercise",
    ]);
    expect(result.missingFields).toEqual(["regularity", "caffeine", "mealExercise"]);
  });

  it("uses exercise timing before target bed instead of exercise duration", () => {
    const input = (exerciseHourUtc: string) => ({
      localDate: "2026-08-20",
      timezone: "Asia/Seoul",
      goal: {
        targetBedTime: "23:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      },
      computedAt: "2026-08-20T00:00:00.000Z",
      days: [17, 18, 19].map((day) => ({
        localDate: `2026-08-${day}`,
        sleepMinutes: 480,
        bedMinuteOfDay: 1380,
        wakeMinuteOfDay: 420,
        caffeine: [],
        alcoholServings: null,
        lastPhoneUseAt: null,
        phoneDurationMinutes: null,
        exerciseMinutes: 30,
        lastExerciseAt: `2026-08-${day}T${exerciseHourUtc}:00:00.000Z`,
        lastMealAt: null,
        fatigueLevel: null,
        stressLevel: null,
      })),
    } as const);

    expect(calculateAnalysis(input("11")).readiness).toBe(100);
    expect(calculateAnalysis(input("13")).readiness).toBe(86);
  });
});
