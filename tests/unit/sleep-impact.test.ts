import { describe, expect, it } from "vitest";

import { calculateSleepImpact } from "@/modules/analysis/domain/calculate-sleep-impact";

describe("calculateSleepImpact", () => {
  it("requires three nights in both cohorts", () => {
    const result = calculateSleepImpact({
      factor: "caffeine",
      exposed: [7.0, 6.8],
      unexposed: [6.5, 6.6, 6.7],
    });

    expect(result.confidence).toBe("insufficient");
    expect(result.deltaMinutes).toBeNull();
    expect(result.evidence[0].code).toBe("sleep-impact-insufficient-data");
  });

  it("reports positive association when exposed nights sleep longer", () => {
    const result = calculateSleepImpact({
      factor: "phone",
      exposed: [7.8, 8.0, 7.6],
      unexposed: [7.0, 6.8, 7.1],
    });

    expect(result.confidence).toBe("medium");
    expect(result.exposedCount).toBe(3);
    expect(result.unexposedCount).toBe(3);
    expect(result.evidence[0].code).toBe("sleep-impact-positive-association");
    expect(result.evidence[0].direction).toBe("positive");
    expect(result.deltaMinutes).toBeCloseTo(0.4333333333, 6);
  });
});
