import { describe, expect, it, vi } from "vitest";
import { attemptCurrentAnalysisNarration } from "@/modules/narration/application/attempt-current-analysis-narration";
import type { AnalysisRepository } from "@/modules/analysis/application/ports";
import type { AnalysisResult } from "@/modules/analysis/domain/types";
import type { NarrationRepository } from "@/modules/narration/application/ports";

const scope = { userId: "analysis-user", timezone: "Asia/Seoul" };
const clock = { now: () => new Date("2026-08-20T16:00:00.000Z") };

const result: AnalysisResult = {
  readiness: 72,
  confidence: "medium",
  metrics: {
    sleepRhythmStability: 64,
    phoneWindDown: 56,
    caffeineSignal: 70,
    sleepGoalAttainment: 72,
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
    sourceDistribution: { manual: 14 },
    computedAt: "2026-08-20T16:00:00.000Z",
    algorithmVersion: "provisional-v1",
    confidence: "medium",
  },
  evidence: [],
  missingFields: [],
};

type CurrentSnapshot = Awaited<ReturnType<AnalysisRepository["findCurrent"]>>;

const analysisRepositoryFor = (current: CurrentSnapshot) => ({
  findCurrent: vi.fn().mockResolvedValue(current),
}) as unknown as AnalysisRepository;

const narrationRepository = () => ({
  createPending: vi.fn(),
  markReady: vi.fn(),
  markFallback: vi.fn(),
  recoverStalePending: vi.fn(),
  retry: vi.fn(),
  findForAnalysisSnapshot: vi.fn(),
}) as unknown as NarrationRepository;

describe("attemptCurrentAnalysisNarration", () => {
  it("reads only the caller's current local-date snapshot and persists immutable facts before generation", async () => {
    const analysisRepository = analysisRepositoryFor({
      ok: true,
      value: {
        id: "current-snapshot",
        localDate: "2026-08-21",
        timezone: "Asia/Seoul",
        status: "current",
        baselineSnapshotId: "baseline-1",
        result,
        generatedAt: new Date("2026-08-20T16:00:00.000Z"),
        supersededAt: null,
      },
    });
    const repository = narrationRepository();
    const createPending = vi.mocked(repository.createPending).mockResolvedValue({ narrationId: "narration-1", created: true });
    const markReady = vi.mocked(repository.markReady).mockResolvedValue();
    const provider = {
      generate: vi.fn().mockResolvedValue({
        headline: "기록 흐름 정리",
        body: "기록된 흐름을 바탕으로 오늘의 준비를 정리했어요.",
        bullets: [],
      }),
    };

    await expect(attemptCurrentAnalysisNarration(scope, {
      clock,
      analysisRepository,
      narrationDependencies: { provider, repository },
    })).resolves.toEqual({ status: "ready" });

    expect(analysisRepository.findCurrent).toHaveBeenCalledWith("2026-08-21");
    expect(createPending).toHaveBeenCalledWith(
      { analysisSnapshotId: "current-snapshot", scheduleAdviceId: null },
      expect.any(String),
      expect.objectContaining({ target: { kind: "analysis", id: "current-snapshot" } }),
    );
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({ target: { kind: "analysis", id: "current-snapshot" } }),
      expect.any(AbortSignal),
    );
    expect(markReady).toHaveBeenCalledWith("narration-1", expect.objectContaining({ schemaVersion: 1 }));
    expect(repository.markFallback).not.toHaveBeenCalled();
  });

  it.each([
    ["missing current snapshot", null],
    ["corrupt current snapshot", { ok: false, failure: { code: "CORRUPT_ANALYSIS_SNAPSHOT", snapshotId: "broken-snapshot" } }],
  ])("does not write or call a provider for a %s", async (_label, current) => {
    const analysisRepository = analysisRepositoryFor(current as CurrentSnapshot);
    const repository = narrationRepository();
    const provider = { generate: vi.fn() };

    await expect(attemptCurrentAnalysisNarration(scope, {
      clock,
      analysisRepository,
      narrationDependencies: { provider, repository },
    })).resolves.toEqual({ status: "not-available" });

    expect(repository.createPending).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(repository.markReady).not.toHaveBeenCalled();
    expect(repository.markFallback).not.toHaveBeenCalled();
  });

  it("does not dispatch a second provider call when the current snapshot already has narration", async () => {
    const analysisRepository = analysisRepositoryFor({
      ok: true,
      value: {
        id: "current-snapshot",
        localDate: "2026-08-21",
        timezone: "Asia/Seoul",
        status: "current",
        baselineSnapshotId: "baseline-1",
        result,
        generatedAt: new Date("2026-08-20T16:00:00.000Z"),
        supersededAt: null,
      },
    });
    const repository = narrationRepository();
    vi.mocked(repository.createPending).mockResolvedValue({ narrationId: "existing-narration", created: false });
    const provider = { generate: vi.fn() };

    await expect(attemptCurrentAnalysisNarration(scope, {
      clock,
      analysisRepository,
      narrationDependencies: { provider, repository },
    })).resolves.toEqual({ status: "already-exists" });

    expect(provider.generate).not.toHaveBeenCalled();
    expect(repository.markReady).not.toHaveBeenCalled();
    expect(repository.markFallback).not.toHaveBeenCalled();
  });

  it("persists a deterministic fallback before honestly reporting an unavailable model", async () => {
    const analysisRepository = analysisRepositoryFor({
      ok: true,
      value: {
        id: "current-snapshot",
        localDate: "2026-08-21",
        timezone: "Asia/Seoul",
        status: "current",
        baselineSnapshotId: "baseline-1",
        result,
        generatedAt: new Date("2026-08-20T16:00:00.000Z"),
        supersededAt: null,
      },
    });
    const repository = narrationRepository();
    vi.mocked(repository.createPending).mockResolvedValue({ narrationId: "narration-1", created: true });
    vi.mocked(repository.markFallback).mockResolvedValue();

    await expect(attemptCurrentAnalysisNarration(scope, {
      clock,
      analysisRepository,
      narrationDependencies: { provider: null, repository },
    })).resolves.toEqual({ status: "unavailable", narrationId: "narration-1" });

    expect(repository.markFallback).toHaveBeenCalledWith("narration-1", expect.objectContaining({
      schemaVersion: 1,
      headline: "현재 기록으로 본 수면 준비 상태",
    }));
    expect(repository.markReady).not.toHaveBeenCalled();
  });
});
