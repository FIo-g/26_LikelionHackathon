import { afterAll, describe, expect, it, vi } from "vitest";

import { recalculateAnalysis } from "@/modules/analysis/application/recalculate-analysis";
import type { AnalysisRepository, BaselineSnapshotEntity } from "@/modules/analysis/application/ports";
import type { AnalysisResult, BaselineResult, NormalizedAnalysisInput, SleepGoal } from "@/modules/analysis/domain/types";
import { createAnalysisRepository } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import { createTestPrismaClient } from "../support/prisma-client";

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
  let baselineSequence = 1;

  return {
    rows,
    loadWindow: vi.fn(async (localDate: string): Promise<NormalizedAnalysisInput> => buildInput(localDate)),
    supersedeCurrentBaseline: vi.fn(async () => {}),
    saveCurrentBaseline: vi.fn(async (baseline): Promise<BaselineSnapshotEntity> => ({
      id: `baseline-${baselineSequence++}`,
      timezone: "Asia/Seoul",
      status: "current",
      result: baseline,
      generatedAt: new Date("2026-08-20T00:00:00.000Z"),
      supersededAt: null,
    })),
    findCurrentBaseline: vi.fn(async () => null),
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
    expect(repository.supersedeCurrentBaseline).toHaveBeenCalledTimes(2);
    expect(repository.saveCurrentBaseline).toHaveBeenCalledTimes(2);
    expect(repository.saveCurrent).toHaveBeenNthCalledWith(
      1,
      "2026-08-19",
      "baseline-1",
      expect.any(Object),
      expect.any(Array),
    );
    expect(repository.saveCurrent).toHaveBeenNthCalledWith(
      2,
      "2026-08-19",
      "baseline-2",
      expect.any(Object),
      expect.any(Array),
    );
  });
});

const persistedAnalysisResult: AnalysisResult = {
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
    sourceDistribution: { manual: 1 },
    computedAt: "2026-08-20T00:00:00.000Z",
    algorithmVersion: "provisional-v1",
    confidence: "medium",
  },
  evidence: [],
  missingFields: [],
};

const persistedBaseline: BaselineResult = {
  baselineSleepMinutes: 480,
  baselineBedMinuteOfDay: 1380,
  baselineWakeMinuteOfDay: 420,
  sampleCount: 7,
  excludedCount: 0,
  confidence: "medium",
};

describe("snapshot envelope persistence", () => {
  it("writes and reads validated baseline envelopes", async () => {
    const stored: Array<Record<string, unknown>> = [];
    const baselineSnapshot = {
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = {
          id: "baseline-1",
          ...args.data,
          generatedAt: args.data.generatedAt as Date,
          supersededAt: null,
        };
        stored.push(row);
        return row;
      }),
      findMany: vi.fn(async () => stored),
    };
    const repository = createAnalysisRepository({ baselineSnapshot } as never, {
      userId: "baseline-user",
      timezone: "Asia/Seoul",
    }, { now: () => new Date("2026-08-20T00:00:00.000Z") });

    const saved = await repository.saveCurrentBaseline(persistedBaseline);
    const read = await repository.findCurrentBaseline();

    expect(saved).toMatchObject({ id: "baseline-1", result: persistedBaseline });
    expect(baselineSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        result: { schemaVersion: 1, baseline: persistedBaseline },
      }),
    }));
    expect(read).toEqual({ ok: true, value: saved });

    stored[0]!.result = JSON.stringify({ schemaVersion: 1, padding: "x".repeat(70_000) });
    await expect(repository.findCurrentBaseline()).resolves.toEqual({
      ok: false,
      failure: {
        code: "CORRUPT_BASELINE_SNAPSHOT",
        snapshotId: "baseline-1",
      },
    });
  });

  it("rejects oversized analysis snapshots on write and read", async () => {
    const analysisSnapshot = {
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({ id: "analysis-1" })),
      findMany: vi.fn(async () => [{
        id: "analysis-oversized",
        localDate: "2026-08-20",
        timezone: "Asia/Seoul",
        status: "current",
        result: JSON.stringify({ schemaVersion: 1, padding: "x".repeat(70_000) }),
        generatedAt: new Date("2026-08-20T00:00:00.000Z"),
        supersededAt: null,
      }]),
    };
    const repository = createAnalysisRepository({
      analysisSnapshot,
      impactFactor: { createMany: vi.fn(async () => ({ count: 0 })) },
    } as never, { userId: "analysis-user", timezone: "Asia/Seoul" });
    const oversizedResult: AnalysisResult = {
      ...persistedAnalysisResult,
      evidence: [{
        code: "sleep-impact-neutral-association",
        label: "x".repeat(70_000),
        direction: "neutral",
        value: null,
        count: 1,
      }],
    };

    await expect(repository.saveCurrent("2026-08-20", "baseline-1", persistedAnalysisResult, []))
      .resolves.toEqual({ snapshotId: "analysis-1" });
    expect(analysisSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        result: {
          schemaVersion: 1,
          baselineSnapshotId: "baseline-1",
          analysisResult: persistedAnalysisResult,
        },
      }),
    }));
    await expect(repository.saveCurrent("2026-08-20", "baseline-1", oversizedResult, []))
      .rejects.toThrow("JSON_TOO_LARGE");
    await expect(repository.findCurrent("2026-08-20")).resolves.toEqual({
      ok: false,
      failure: {
        code: "CORRUPT_ANALYSIS_SNAPSHOT",
        snapshotId: "analysis-oversized",
      },
    });
    expect(analysisSnapshot.create).toHaveBeenCalledTimes(1);
  });
});

describe("sleep-impact observation alignment", () => {
  it("links an evening behavior to the sleep interval that follows it", async () => {
    const emptyRows = { findMany: vi.fn(async () => []) };
    const repository = createAnalysisRepository({
      sleepGoal: {
        findUnique: vi.fn(async () => ({
          targetBedTime: "23:00",
          targetWakeTime: "07:00",
          targetDurationMinutes: 480,
        })),
      },
      sleepSession: {
        findMany: vi.fn(async () => [{
          sleepDate: "2026-08-20",
          startedAt: new Date("2026-08-19T14:00:00.000Z"),
          endedAt: new Date("2026-08-19T22:00:00.000Z"),
          timezone: "Asia/Seoul",
          updatedAt: new Date("2026-08-19T22:00:00.000Z"),
        }]),
      },
      caffeineEntry: {
        findMany: vi.fn(async () => [{
          caffeineMg: 100,
          consumedAt: new Date("2026-08-19T12:00:00.000Z"),
          dailyLog: { localDate: "2026-08-19" },
          updatedAt: new Date("2026-08-19T12:00:00.000Z"),
        }]),
      },
      alcoholEntry: emptyRows,
      mealEntry: emptyRows,
      exerciseEntry: emptyRows,
      phoneUsageEntry: emptyRows,
      wellnessEntry: emptyRows,
    } as never, { userId: "alignment-user", timezone: "Asia/Seoul" });

    const input = await repository.loadWindow("2026-08-20", 14);

    expect(input.days.find((day) => day.localDate === "2026-08-20")?.caffeine)
      .toEqual([{ consumedAt: "2026-08-19T12:00:00.000Z", caffeineMg: 100 }]);
    expect(input.days.find((day) => day.localDate === "2026-08-19")?.caffeine).toEqual([]);
  });
});

const sqliteUrl = process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : null;
const describeSqlite = sqliteUrl ? describe : describe.skip;
const prisma = createTestPrismaClient(sqliteUrl ?? "file:./prisma/unused-analysis-recalculation.sqlite");
const exerciseUserId = "analysis-exercise-user";

describeSqlite("persisted analysis input", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: exerciseUserId } });
    await prisma.$disconnect();
  });

  it("includes persisted exercise duration in the matching analysis day", async () => {
    await prisma.user.deleteMany({ where: { id: exerciseUserId } });
    await prisma.user.create({ data: { id: exerciseUserId } });
    await prisma.sleepGoal.create({
      data: {
        userId: exerciseUserId,
        targetBedTime: "23:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      },
    });
    const dailyLog = await prisma.dailyLog.create({
      data: {
        userId: exerciseUserId,
        localDate: "2026-08-20",
        timezone: "Asia/Seoul",
      },
    });
    await prisma.exerciseEntry.create({
      data: {
        userId: exerciseUserId,
        dailyLogId: dailyLog.id,
        exerciseType: "run",
        intensity: "moderate",
        startedAt: new Date("2026-08-20T09:00:00.000Z"),
        endedAt: new Date("2026-08-20T09:45:00.000Z"),
        timezone: "Asia/Seoul",
      },
    });

    const repository = createAnalysisRepository(prisma as never, {
      userId: exerciseUserId,
      timezone: "Asia/Seoul",
    });
    const input = await repository.loadWindow("2026-08-20", 14);

    expect(input.days.find((day) => day.localDate === "2026-08-20")?.exerciseMinutes).toBe(45);
  });
});
