import { describe, expect, it } from "vitest";

import { previewWhatIf } from "@/modules/planner/domain/preview-what-if";
import { calculateAnalysis } from "@/modules/analysis/domain/provisional-v1";

const analysisInput = {
  localDate: "2026-08-22",
  timezone: "Asia/Seoul",
  goal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
  computedAt: "2026-08-22T12:00:00.000Z",
  days: [{
    localDate: "2026-08-22",
    sleepMinutes: 480,
    bedMinuteOfDay: 1380,
    wakeMinuteOfDay: 420,
    caffeine: [],
    alcoholServings: 0,
    lastPhoneUseAt: null,
    phoneDurationMinutes: 0,
    exerciseMinutes: 0,
    lastMealAt: null,
    fatigueLevel: 2,
    stressLevel: 2,
  }],
} as const;

describe("previewWhatIf", () => {
  it("previews caffeine from a copied calculation input without changing that input", () => {
    const beforeInput = structuredClone(analysisInput);

    const result = previewWhatIf({
      input: analysisInput,
      caffeine: { consumedAt: "2026-08-22T12:00:00.000Z", caffeineMg: 160 },
    }, { calculateAnalysis });

    expect(result.kind).toBe("caffeine-added");
    expect(result.actualRecordHref).toBe("/record/caffeine");
    expect(analysisInput).toEqual(beforeInput);
    expect(result.before).toEqual(calculateAnalysis(beforeInput));
  });
});
