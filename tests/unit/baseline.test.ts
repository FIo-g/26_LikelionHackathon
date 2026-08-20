import { describe, expect, it } from "vitest";

import { calculateBaseline } from "@/modules/analysis/domain/calculate-baseline";
import type { NormalizedAnalysisInput } from "@/modules/analysis/domain/types";

const dayFixture = (input: {
  localDate: string;
  sleepMinutes: number | null;
  bedMinuteOfDay: number | null;
  wakeMinuteOfDay: number | null;
  caffeine?: never;
}) => {
  return {
    localDate: input.localDate,
    sleepMinutes: input.sleepMinutes,
    bedMinuteOfDay: input.bedMinuteOfDay,
    wakeMinuteOfDay: input.wakeMinuteOfDay,
    caffeine: [],
    alcoholServings: null,
    lastPhoneUseAt: null,
    phoneDurationMinutes: null,
    exerciseMinutes: null,
    lastMealAt: null,
    fatigueLevel: null,
    stressLevel: null,
  };
};

describe("calculateBaseline", () => {
  it("marks fewer than three valid sleep days insufficient", () => {
    const input: NormalizedAnalysisInput = {
      localDate: "2026-08-10",
      timezone: "Asia/Seoul",
      goal: {
        targetBedTime: "22:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      },
      computedAt: "2026-08-10T00:00:00Z",
      days: [
        dayFixture({
          localDate: "2026-08-01",
          sleepMinutes: 420,
          bedMinuteOfDay: 1320,
          wakeMinuteOfDay: 420,
        }),
        dayFixture({
          localDate: "2026-08-02",
          sleepMinutes: 430,
          bedMinuteOfDay: 1325,
          wakeMinuteOfDay: 410,
        }),
        {
          ...dayFixture({
            localDate: "invalid-date",
            sleepMinutes: 440,
            bedMinuteOfDay: 1320,
            wakeMinuteOfDay: 420,
          }),
          localDate: "2026-13-40",
        },
      ],
    };

    const result = calculateBaseline(input);

    expect(result.confidence).toBe("insufficient");
    expect(result.sampleCount).toBe(2);
    expect(result.excludedCount).toBe(1);
  });

  it("excludes a format-valid calendar date that does not exist", () => {
    const input: NormalizedAnalysisInput = {
      localDate: "2026-03-01",
      timezone: "Asia/Seoul",
      goal: {
        targetBedTime: "22:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      },
      computedAt: "2026-03-01T00:00:00Z",
      days: [
        dayFixture({ localDate: "2026-02-27", sleepMinutes: 420, bedMinuteOfDay: 1320, wakeMinuteOfDay: 420 }),
        dayFixture({ localDate: "2026-02-28", sleepMinutes: 430, bedMinuteOfDay: 1325, wakeMinuteOfDay: 410 }),
        dayFixture({ localDate: "2026-02-30", sleepMinutes: 440, bedMinuteOfDay: 1330, wakeMinuteOfDay: 400 }),
      ],
    };

    const result = calculateBaseline(input);

    expect(result.confidence).toBe("insufficient");
    expect(result.sampleCount).toBe(2);
    expect(result.excludedCount).toBe(1);
  });

  it("computes a valid median sleep baseline when samples are enough", () => {
    const input: NormalizedAnalysisInput = {
      localDate: "2026-08-10",
      timezone: "Asia/Seoul",
      goal: {
        targetBedTime: "22:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      },
      computedAt: "2026-08-10T00:00:00Z",
      days: [
        dayFixture({ localDate: "2026-08-01", sleepMinutes: 420, bedMinuteOfDay: 1320, wakeMinuteOfDay: 420 }),
        dayFixture({ localDate: "2026-08-02", sleepMinutes: 480, bedMinuteOfDay: 1330, wakeMinuteOfDay: 410 }),
        dayFixture({ localDate: "2026-08-03", sleepMinutes: 540, bedMinuteOfDay: 1340, wakeMinuteOfDay: 400 }),
      ],
    };

    const result = calculateBaseline(input);

    expect(result.sampleCount).toBe(3);
    expect(result.baselineSleepMinutes).toBe(480);
    expect(result.baselineBedMinuteOfDay).not.toBeNull();
    expect(result.baselineWakeMinuteOfDay).not.toBeNull();
  });
});
