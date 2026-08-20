import { describe, expect, it, vi } from "vitest";

import { getAnalyzeViewModel } from "@/modules/analysis/application/get-analyze-view-model";
import * as analysisRepositoryModule from "@/modules/analysis/infrastructure/prisma-analysis-repository";

vi.mock("@/modules/analysis/infrastructure/prisma-analysis-repository", () => ({ createAnalysisRepository: vi.fn() }));
vi.mock("@/modules/planner/application/get-plan-view-model", () => ({ getPlanViewModel: vi.fn(async () => ({ advice: null })) }));

const createAnalysisRepository = vi.mocked(analysisRepositoryModule.createAnalysisRepository);
const result = {
  readiness: 72,
  confidence: "medium" as const,
  metrics: { sleepRhythmStability: 68, phoneWindDown: 61, caffeineSignal: 55, sleepGoalAttainment: 74 },
  dataBasis: {
    periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 1, missingFields: [],
    completenessByCategory: { sleep: 1, phone: 1, meal: 1, exercise: 1, caffeine: 1, alcohol: 1, wellness: 1 },
    sourceDistribution: { manual: 10 }, computedAt: "2026-08-19T09:00:00.000Z", algorithmVersion: "provisional-v1" as const, confidence: "medium" as const,
  },
  evidence: [{ code: "steady", label: "최근 취침 시간이 비교적 일정합니다.", direction: "positive" as const, value: 68, count: 10 }],
  missingFields: [],
};

describe("getAnalyzeViewModel", () => {
  it("builds immutable metrics, trend, and template report from the current stored analysis facts", async () => {
    createAnalysisRepository.mockReturnValue({
      findCurrent: async () => ({ ok: true, value: { id: "snapshot-1", localDate: "2026-08-19", timezone: "Asia/Seoul", status: "current", result, generatedAt: new Date(), supersededAt: null } }),
      findLastSuccessful: async () => null,
      loadWindow: async () => ({ localDate: "2026-08-19", timezone: "Asia/Seoul", goal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }, computedAt: "2026-08-19T09:00:00.000Z", days: [{ localDate: "2026-08-19", sleepMinutes: 450, bedMinuteOfDay: 1380, wakeMinuteOfDay: 420, caffeine: [], alcoholServings: 0, lastPhoneUseAt: null, phoneDurationMinutes: 0, exerciseMinutes: 0, lastMealAt: null, fatigueLevel: 2, stressLevel: 2 }] }),
      supersedeCurrent: async () => undefined, saveCurrent: async () => ({ snapshotId: "noop" }),
    });

    const model = await getAnalyzeViewModel({ userId: "u-1", timezone: "Asia/Seoul" }, { clock: { now: () => new Date("2026-08-19T09:00:00.000Z") }, getPrisma: () => ({}) });

    expect(model.state).toBe("ready");
    expect(model.metrics).toEqual(expect.arrayContaining([expect.objectContaining({ key: "caffeine-signal", value: 55 })]));
    expect(model.trend).toEqual([{ localDate: "2026-08-19", sleepMinutes: 450, goalMinutes: 480 }]);
    expect(model.report.status).toBe("template-fallback");
    expect(model.dataBasis.periodStart).toBe("2026-08-06");
  });
});
