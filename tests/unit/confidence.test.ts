import { describe, expect, it } from "vitest";

import { calculateBaseline } from "@/modules/analysis/domain/calculate-baseline";
import { calculateConfidence } from "@/modules/analysis/domain/calculate-confidence";
import type { NormalizedAnalysisInput } from "@/modules/analysis/domain/types";

describe("calculateConfidence", () => {
  it("requires at least three valid sleep days for insufficient confidence", () => {
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
        {
          localDate: "2026-08-01",
          sleepMinutes: 420,
          bedMinuteOfDay: 1320,
          wakeMinuteOfDay: 420,
          caffeine: [],
          alcoholServings: null,
          lastPhoneUseAt: null,
          phoneDurationMinutes: null,
          exerciseMinutes: null,
          lastMealAt: null,
          fatigueLevel: null,
          stressLevel: null,
        },
        {
          localDate: "2026-08-02",
          sleepMinutes: 430,
          bedMinuteOfDay: 1320,
          wakeMinuteOfDay: 420,
          caffeine: [],
          alcoholServings: null,
          lastPhoneUseAt: null,
          phoneDurationMinutes: null,
          exerciseMinutes: null,
          lastMealAt: null,
          fatigueLevel: null,
          stressLevel: null,
        },
      ],
    };

    const baseline = calculateBaseline(input);
    const confidence = calculateConfidence({ days: input.days, baseline });

    expect(confidence.level).toBe("insufficient");
    expect(confidence.score).toBe(0);
    expect(confidence.sampleScore).toBeCloseTo(2 / 14);
  });

  it("rewards complete 14-day sample with all categories", () => {
    const fixtureDays = Array.from({ length: 14 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return {
        localDate: `2026-08-${day}`,
        sleepMinutes: 480,
        bedMinuteOfDay: 1320,
        wakeMinuteOfDay: 420,
        caffeine: [{ consumedAt: "2026-08-01T13:00:00Z", caffeineMg: 0 }],
        alcoholServings: 1,
        lastPhoneUseAt: "2026-08-01T23:00:00Z",
        phoneDurationMinutes: 10,
        exerciseMinutes: 90,
        lastMealAt: "2026-08-01T18:00:00Z",
        fatigueLevel: 3,
        stressLevel: null,
      };
    });

    const input: NormalizedAnalysisInput = {
      localDate: "2026-08-14",
      timezone: "Asia/Seoul",
      goal: {
        targetBedTime: "22:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      },
      computedAt: "2026-08-14T00:00:00Z",
      days: fixtureDays,
    };

    const baseline = calculateBaseline(input);
    const confidence = calculateConfidence({ days: input.days, baseline });

    expect(confidence.level).toBe("high");
    expect(confidence.sampleScore).toBe(1);
    expect(confidence.completeness).toBe(1);
    expect(confidence.repeatability).toBe(1);
    expect(confidence.score).toBeCloseTo(0.96);
  });
});
