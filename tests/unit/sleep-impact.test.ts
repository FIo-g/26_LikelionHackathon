import { describe, expect, it } from "vitest";

import {
  calculateSleepImpact,
  classifySleepImpactRow,
} from "@/modules/analysis/domain/calculate-sleep-impact";
import type { NormalizedDailyRecords } from "@/modules/analysis/domain/types";

const row = (overrides: Partial<NormalizedDailyRecords> = {}): NormalizedDailyRecords => ({
  localDate: "2026-08-20",
  sleepMinutes: 480,
  bedMinuteOfDay: 1380,
  wakeMinuteOfDay: 420,
  caffeine: [],
  alcoholServings: null,
  lastPhoneUseAt: null,
  phoneDurationMinutes: null,
  exerciseMinutes: null,
  lastExerciseAt: null,
  lastMealAt: null,
  fatigueLevel: null,
  stressLevel: null,
  ...overrides,
});

describe("calculateSleepImpact", () => {
  it("requires three nights in both cohorts", () => {
    const result = calculateSleepImpact({
      factor: "caffeine",
      exposed: [420, 408],
      unexposed: [390, 396, 402],
    });

    expect(result.confidence).toBe("insufficient");
    expect(result.deltaMinutes).toBeNull();
    expect(result.evidence[0].code).toBe("sleep-impact-insufficient-data");
  });

  it("reports positive association when exposed nights sleep longer", () => {
    const result = calculateSleepImpact({
      factor: "phone",
      exposed: [468, 480, 456],
      unexposed: [420, 408, 426],
    });

    expect(result.confidence).toBe("medium");
    expect(result.exposedCount).toBe(3);
    expect(result.unexposedCount).toBe(3);
    expect(result.evidence[0].code).toBe("sleep-impact-positive-association");
    expect(result.evidence[0].direction).toBe("positive");
    expect(result.deltaMinutes).toBe(50);
  });

  it.each([
    ["caffeine", row({ caffeine: [] })],
    ["phone", row({ lastPhoneUseAt: null })],
    ["alcohol", row({ alcoholServings: null })],
    ["meal", row({ lastMealAt: null })],
    ["exercise", row({ lastExerciseAt: null })],
  ] as const)("places a missing %s exposure in neither cohort", (factor, missingRow) => {
    expect(classifySleepImpactRow({
      factor,
      row: missingRow,
      timezone: "Asia/Seoul",
      targetBedMinuteOfDay: 1380,
    })).toEqual({ exposed: false, unexposed: false });
  });

  it("uses the approved target-bed thresholds", () => {
    const timezone = "Asia/Seoul";
    const targetBedMinuteOfDay = 1380;

    expect(classifySleepImpactRow({
      factor: "caffeine",
      row: row({ caffeine: [{ consumedAt: "2026-08-20T12:00:00.000Z", caffeineMg: 100 }] }),
      timezone,
      targetBedMinuteOfDay,
    })).toEqual({ exposed: true, unexposed: false });
    expect(classifySleepImpactRow({
      factor: "phone",
      row: row({ lastPhoneUseAt: "2026-08-20T13:01:00.000Z" }),
      timezone,
      targetBedMinuteOfDay,
    })).toEqual({ exposed: true, unexposed: false });
    expect(classifySleepImpactRow({
      factor: "meal",
      row: row({ lastMealAt: "2026-08-20T11:01:00.000Z" }),
      timezone,
      targetBedMinuteOfDay,
    })).toEqual({ exposed: true, unexposed: false });
    expect(classifySleepImpactRow({
      factor: "exercise",
      row: row({ lastExerciseAt: "2026-08-20T12:01:00.000Z", exerciseMinutes: 30 }),
      timezone,
      targetBedMinuteOfDay,
    })).toEqual({ exposed: true, unexposed: false });
  });

  it.each([
    ["phone", { lastPhoneUseAt: "2026-08-20T13:00:00.000Z" }, { lastPhoneUseAt: "2026-08-20T12:59:00.000Z" }],
    ["meal", { lastMealAt: "2026-08-20T11:00:00.000Z" }, { lastMealAt: "2026-08-20T10:59:00.000Z" }],
    ["exercise", { lastExerciseAt: "2026-08-20T12:00:00.000Z", exerciseMinutes: 30 }, { lastExerciseAt: "2026-08-20T11:59:00.000Z", exerciseMinutes: 30 }],
  ] as const)("includes the exact %s cutoff and excludes the adjacent outside minute", (factor, atCutoff, outsideCutoff) => {
    const classification = (overrides: Partial<NormalizedDailyRecords>) => classifySleepImpactRow({
      factor,
      row: row(overrides),
      timezone: "Asia/Seoul",
      targetBedMinuteOfDay: 1380,
    });

    expect(classification(atCutoff)).toEqual({ exposed: true, unexposed: false });
    expect(classification(outsideCutoff)).toEqual({ exposed: false, unexposed: true });
  });
});
