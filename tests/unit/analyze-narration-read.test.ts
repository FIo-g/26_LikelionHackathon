import { describe, expect, it, vi } from "vitest";
import { getAnalyzeViewModel } from "@/modules/analysis/application/get-analyze-view-model";
import type { NarrationRepository } from "@/modules/narration/application/ports";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

describe("Analyze narration read flow", () => {
  it("recovers stale pending narration before rendering its persisted fallback", async () => {
    const narrationRepository = {
      createPending: vi.fn(), markReady: vi.fn(), markFallback: vi.fn(), retry: vi.fn(),
      recoverStalePending: vi.fn().mockResolvedValue(1),
      findForAnalysisSnapshot: vi.fn().mockResolvedValue({
        id: "narration-1", status: "template-fallback", retryCount: 0,
        output: { schemaVersion: 1, headline: "현재 기록으로 본 수면 준비 상태", body: "대체 본문", bullets: [] },
      }),
    } as unknown as NarrationRepository;
    const analysisRepository = {
      findCurrent: vi.fn().mockResolvedValue({ ok: true, value: {
        id: "snapshot-1", localDate: "2026-08-20", timezone: "Asia/Seoul", status: "current",
        result: {
          readiness: 72, confidence: "medium", metrics: { sleepRhythmStability: 60, phoneWindDown: 60, caffeineSignal: 60, sleepGoalAttainment: 60 },
          dataBasis: { periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 0, missingFields: [], completenessByCategory: { sleep: 1, phone: 1, meal: 1, exercise: 1, caffeine: 1, alcohol: 1, wellness: 1 }, sourceDistribution: { manual: 10 }, computedAt: "2026-08-20T00:00:00.000Z", algorithmVersion: "provisional-v1", confidence: "medium" }, evidence: [], missingFields: [],
        }, generatedAt: new Date(), supersededAt: null,
      } }),
      findLastSuccessful: vi.fn(),
      loadWindow: vi.fn().mockResolvedValue({ goal: { targetDurationMinutes: 480 }, days: [] }),
    };

    const viewModel = await getAnalyzeViewModel(scope, {
      clock: { now: () => new Date("2026-08-20T00:01:00.000Z") }, getPrisma: () => ({ narration: {} } as never),
      createAnalysisRepository: () => analysisRepository as never,
      createPlannerRepository: () => ({ listEvents: async () => [], findLatestGeneratedAdvice: async () => null, findLatestDismissedAdvice: async () => null, findActivePlan: async () => null, findCurrentGoal: async () => null }) as never,
      createNarrationRepository: () => narrationRepository,
    });

    expect((narrationRepository.recoverStalePending as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]).toBeLessThan(
      (narrationRepository.findForAnalysisSnapshot as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
    expect(viewModel.report).toMatchObject({ status: "template-fallback", headline: "현재 기록으로 본 수면 준비 상태" });
    expect(viewModel.narration).toMatchObject({ id: "narration-1", retryAvailable: true });
  });
});
