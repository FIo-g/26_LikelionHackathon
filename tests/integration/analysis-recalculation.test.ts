import { describe, expect, it, vi } from "vitest";

import { recalculateAnalysis } from "@/modules/analysis/application/recalculate-analysis";
import type { AnalysisRepository } from "@/modules/analysis/application/ports";
import type { AnalysisResult, NormalizedAnalysisInput, SleepGoal } from "@/modules/analysis/domain/types";

vi.mock("@/modules/analysis/domain/provisional-v1", () => ({
  calculateAnalysis: vi.fn(() => ({
    readiness: 78,
    confidence: "medium",
    metrics: {
      sleepRhythmStability: 64,
      phoneWindDown: 56,
      caffeineSignal: 70,
      sleepGoalAttainment: 72,
    },
    dataBasis: {
      periodStart: "2026-08-06",
      periodEnd: "2026-08-19",
      sampleCount: 14,
      excludedCount: 0,
      missingFields: [],
      completenessByCategory: {
        sleep: 1,
        phone: 1,
        meal: 1,
        exercise: 1,
        caffeine: 1,
        alcohol: 1,
        wellness: 1,
      },
      sourceDistribution: {
        manual: 14,
      },
      computedAt: "2026-08-20T00:00:00.000Z",
      algorithmVersion: "provisional-v1",
      confidence: "medium",
    },
    evidence: [],
    missingFields: [],
  }) as AnalysisResult),
}));

type SnapshotState = {
  localDate: string;
  snapshotId: string;
  status: "current" | "superseded";
};

const buildInput = (localDate: string): NormalizedAnalysisInput => {
  const parsed = new Date(`${localDate}T00:00:00.000Z`);
  const day0 = new Date(parsed.getTime() - 13 * 24 * 60 * 60 * 1000);
  const goal: SleepGoal = {
    targetBedTime: "23:00",
    targetWakeTime: "07:00",
    targetDurationMinutes: 480,
  };

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(day0.getTime() + index * 24 * 60 * 60 * 1000);
    return {
      localDate: date.toISOString().slice(0, 10),
      sleepMinutes: 450,
      bedMinuteOfDay: 1380,
      wakeMinuteOfDay: 360,
      caffeine: [],
      alcoholServings: 0,
      lastPhoneUseAt: null,
      phoneDurationMinutes: null,
      exerciseMinutes: 30,
      lastMealAt: null,
      fatigueLevel: 2,
      stressLevel: 2,
    };
  });

  return {
    localDate,
    timezone: "Asia/Seoul",
    goal,
    days,
    computedAt: new Date(`${localDate}T00:00:00.000Z`).toISOString(),
  };
};

const createMockAnalysisRepository = (): AnalysisRepository & { rows: SnapshotState[] } => {
  const rows: SnapshotState[] = [];
  let snapshotSequence = 1;

  return {
    rows,
    loadWindow: vi.fn(async (localDate: string): Promise<NormalizedAnalysisInput> => buildInput(localDate)),
    supersedeCurrent: vi.fn(async (localDate: string) => {
      for (const row of rows) {
        if (row.localDate === localDate && row.status === "current") {
          row.status = "superseded";
        }
      }
    }),
    saveCurrent: vi.fn(async (localDate: string) => {
      const snapshotId = `snapshot-${snapshotSequence}`;
      rows.push({
        localDate,
        snapshotId,
        status: "current",
      });
      snapshotSequence += 1;
      return { snapshotId };
    }),
    findCurrent: vi.fn(async () => null),
    findLastSuccessful: vi.fn(async () => null),
  };
};

describe("analysis recalculation", () => {
  it("supersedes the current snapshot and appends a new result", async () => {
    const repository = createMockAnalysisRepository();
    const clock = { now: () => new Date("2026-08-20T00:00:00.000Z") };

    await recalculateAnalysis(repository, ["2026-08-19"], clock);
    await recalculateAnalysis(repository, ["2026-08-19"], clock);

    expect(repository.rows).toHaveLength(2);
    expect(repository.rows[0].status).toBe("superseded");
    expect(repository.rows[1].status).toBe("current");
    expect(repository.rows[0].snapshotId).not.toBe(repository.rows[1].snapshotId);
  });
});
