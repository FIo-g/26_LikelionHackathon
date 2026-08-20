import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTodayViewModel } from "@/modules/analysis/application/get-today-view-model";
import * as analysisRepositoryModule from "@/modules/analysis/infrastructure/prisma-analysis-repository";

vi.mock("@/modules/analysis/infrastructure/prisma-analysis-repository", () => ({
  createAnalysisRepository: vi.fn(),
}));

const createAnalysisRepositoryMock = vi.mocked(analysisRepositoryModule.createAnalysisRepository);

const createPrisma = (entries: {
  caffeine: boolean;
  alcohol: boolean;
  meal: boolean;
  exercise: boolean;
  sleep: boolean;
  phone: boolean;
  wellness: boolean;
  planDay?: { id: string; targetBedAt: Date; caffeineCutoffAt: Date; exerciseCutoffAt: Date; mealCutoffAt: Date; windDownAt: Date } | null;
}) => ({
  sleepGoal: {
    findUnique: vi.fn(async () => ({
      targetBedTime: "23:00",
      targetWakeTime: "07:00",
      targetDurationMinutes: 480,
    })),
  },
  planDay: {
    findFirst: vi.fn(async () => entries.planDay ?? null),
  },
  caffeineEntry: {
    findFirst: vi.fn(async () => (entries.caffeine ? { id: "caffeine-id" } : null)),
  },
  alcoholEntry: {
    findFirst: async () => (entries.alcohol ? { id: "alcohol-id" } : null),
  },
  mealEntry: {
    findFirst: async () => (entries.meal ? { id: "meal-id", dailyLog: { localDate: "2026-08-20" } } : null),
  },
  exerciseEntry: {
    findFirst: async () => (entries.exercise ? { id: "exercise-id", dailyLog: { localDate: "2026-08-20" } } : null),
  },
  sleepSession: {
    findFirst: async () => (entries.sleep ? { id: "sleep-id", sleepDate: "2026-08-20" } : null),
  },
  phoneUsageEntry: {
    findFirst: async () => (entries.phone ? { id: "phone-id", localDate: "2026-08-20" } : null),
  },
  wellnessEntry: {
    findFirst: async () => (entries.wellness ? { id: "wellness-id", localDate: "2026-08-20" } : null),
  },
});

const scope = { userId: "u-1", timezone: "Asia/Seoul" };
const clock = { now: () => new Date("2026-08-20T03:00:00.000Z") };

const sleepFoundation = {
  readiness: 76,
  confidence: "high",
  metrics: {
    sleepRhythmStability: 61,
    phoneWindDown: 58,
    caffeineSignal: 70,
    sleepGoalAttainment: 64,
  },
  dataBasis: {
    periodStart: "2026-08-07",
    periodEnd: "2026-08-20",
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
    confidence: "high",
  },
  evidence: [],
  missingFields: [],
} as const;

const fallbackSnapshot = {
  id: "snapshot-id",
  baselineSnapshotId: "baseline-id",
  localDate: "2026-08-20",
  timezone: "Asia/Seoul",
  status: "current" as const,
  result: sleepFoundation,
  generatedAt: new Date("2026-08-20T01:00:00.000Z"),
  supersededAt: null,
};

describe("getTodayViewModel", () => {
  beforeEach(() => {
    createAnalysisRepositoryMock.mockReset();
  });

  it("keeps record summary ready even when readiness is stale", async () => {
    createAnalysisRepositoryMock.mockReturnValue({
      findCurrent: async () => ({
        ok: false,
        failure: { code: "CORRUPT_ANALYSIS_SNAPSHOT", snapshotId: "snapshot-corrupt" },
      }),
      findLastSuccessful: async () => ({ ok: true, value: fallbackSnapshot }),
      loadWindow: async () => {
        throw new Error("not expected");
      },
      supersedeCurrentBaseline: async () => {},
      saveCurrentBaseline: async () => { throw new Error("not expected"); },
      findCurrentBaseline: async () => null,
      supersedeCurrent: async () => {},
      saveCurrent: async () => ({ snapshotId: "noop" }),
    });

    const model = await getTodayViewModel(scope, {
      clock,
      getPrisma: () => createPrisma({
        caffeine: true,
        alcohol: true,
        meal: true,
        exercise: true,
        sleep: false,
        phone: false,
        wellness: false,
      }),
    });

    expect(model.readiness.state).toBe("stale");
    expect(model.readiness.data?.score).toBe(76);
    expect(model.readiness.message).toBe("마지막 정상 분석을 표시합니다");
    expect(model.recordSummary.state).toBe("ready");
    expect(model.recordSummary.message).toBe("오늘 기록 4개 완료");
  });

  it("reads a parsed result from a ready snapshot entity", async () => {
    createAnalysisRepositoryMock.mockReturnValue({
      findCurrent: async () => ({ ok: true, value: fallbackSnapshot }),
      findLastSuccessful: async () => null,
      loadWindow: async () => { throw new Error("not expected"); },
      supersedeCurrentBaseline: async () => {},
      saveCurrentBaseline: async () => { throw new Error("not expected"); },
      findCurrentBaseline: async () => null,
      supersedeCurrent: async () => {},
      saveCurrent: async () => ({ snapshotId: "noop" }),
    });

    const model = await getTodayViewModel(scope, {
      clock,
      getPrisma: () => createPrisma({
        caffeine: false,
        alcohol: false,
        meal: false,
        exercise: false,
        sleep: false,
        phone: false,
        wellness: false,
      }),
    });

    expect(model.readiness).toMatchObject({
      state: "ready",
      data: { score: 76, confidence: "high" },
    });
  });

  it("uses error for a corrupt current snapshot without a valid fallback", async () => {
    createAnalysisRepositoryMock.mockReturnValue({
      findCurrent: async () => ({
        ok: false,
        failure: { code: "CORRUPT_ANALYSIS_SNAPSHOT", snapshotId: "snapshot-corrupt" },
      }),
      findLastSuccessful: async () => null,
      loadWindow: async () => { throw new Error("not expected"); },
      supersedeCurrentBaseline: async () => {},
      saveCurrentBaseline: async () => { throw new Error("not expected"); },
      findCurrentBaseline: async () => null,
      supersedeCurrent: async () => {},
      saveCurrent: async () => ({ snapshotId: "noop" }),
    });

    const model = await getTodayViewModel(scope, {
      clock,
      getPrisma: () => createPrisma({
        caffeine: false,
        alcohol: false,
        meal: false,
        exercise: false,
        sleep: false,
        phone: false,
        wellness: false,
      }),
    });

    expect(model.readiness).toMatchObject({
      state: "error",
      data: null,
      message: "분석 데이터가 손상되어 다시 계산해야 합니다",
    });
  });

  it("exposes readiness score as missing only when score is missing", async () => {
    createAnalysisRepositoryMock.mockReturnValue({
      loadWindow: async () => {
        throw new Error("not expected");
      },
      supersedeCurrentBaseline: async () => {},
      saveCurrentBaseline: async () => { throw new Error("not expected"); },
      findCurrentBaseline: async () => null,
      supersedeCurrent: async () => {},
      saveCurrent: async () => ({ snapshotId: "noop" }),
      findCurrent: async () => ({
        ok: true,
        value: {
          ...fallbackSnapshot,
          result: {
            ...sleepFoundation,
            readiness: null,
            confidence: "low",
            missingFields: ["sleepDuration"],
            dataBasis: {
              ...sleepFoundation.dataBasis,
              missingFields: ["sleep", "phone", "meal", "exercise", "caffeine", "alcohol", "wellness"],
            },
          },
        },
      }),
      findLastSuccessful: async () => null,
    });

    const model = await getTodayViewModel(scope, {
      clock,
      getPrisma: () => createPrisma({
        caffeine: false,
        alcohol: false,
        meal: false,
        exercise: false,
        sleep: false,
        phone: false,
        wellness: false,
      }),
    });

    expect(model.readiness.state).toBe("ready");
    expect(model.readiness.data?.score).toBeNull();
    expect(model.readiness.data?.label).toContain("점수 산출 불가");
    expect(model.readiness.data?.label).toContain("낮음");
  });

  it("uses the active plan day cutoffs for today instead of the goal fallback", async () => {
    createAnalysisRepositoryMock.mockReturnValue({
      findCurrent: async () => ({ ok: true, value: fallbackSnapshot }),
      findLastSuccessful: async () => null,
      loadWindow: async () => { throw new Error("not expected"); },
      supersedeCurrentBaseline: async () => {},
      saveCurrentBaseline: async () => { throw new Error("not expected"); },
      findCurrentBaseline: async () => null,
      supersedeCurrent: async () => {},
      saveCurrent: async () => ({ snapshotId: "noop" }),
    });

    const db = createPrisma({
      caffeine: false, alcohol: false, meal: false, exercise: false, sleep: false, phone: false, wellness: false,
      planDay: {
        id: "plan-day-1",
        targetBedAt: new Date("2026-08-20T12:00:00.000Z"),
        caffeineCutoffAt: new Date("2026-08-20T06:00:00.000Z"),
        exerciseCutoffAt: new Date("2026-08-20T09:00:00.000Z"),
        mealCutoffAt: new Date("2026-08-20T08:00:00.000Z"),
        windDownAt: new Date("2026-08-20T11:00:00.000Z"),
      },
    });
    const model = await getTodayViewModel(scope, {
      clock,
      getPrisma: () => db,
    });

    expect(model.preparationTimeline.message).toBe("오늘 목표 취침 21:00 기준");
    expect(model.preparationTimeline.data?.find((step) => step.key === "caffeine")?.scheduledAt).toBe("15:00");
    expect(db.planDay.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: scope.userId,
        localDate: "2026-08-20",
        timezone: scope.timezone,
        status: "active",
      },
    }));
  });
});
