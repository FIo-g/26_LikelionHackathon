import { describe, expect, it, vi } from "vitest";
import { getAnalyzeViewModel } from "@/modules/analysis/application/get-analyze-view-model";
import type { PlannerRepository } from "@/modules/planner/application/ports";
import type { AnalysisRepository } from "@/modules/analysis/application/ports";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

describe("getAnalyzeViewModel planner integration", () => {
  it("uses the real Plan view-model contract to expose generated reroute advice", async () => {
    const plannerRepository = {
      listEvents: vi.fn().mockResolvedValue([]),
      findLatestGeneratedAdvice: vi.fn().mockResolvedValue({
        id: "reroute-advice",
        triggerType: "reroute",
        status: "generated",
        inputSnapshot: { event: null },
        proposal: { days: [] },
      }),
      findLatestDismissedAdvice: vi.fn().mockResolvedValue(null),
      findActivePlan: vi.fn().mockResolvedValue(null),
      findCurrentGoal: vi.fn().mockResolvedValue(null),
      listActiveDays: vi.fn(),
    } as unknown as PlannerRepository;
    const analysisRepository = {
      findCurrent: vi.fn().mockResolvedValue(null),
      findLastSuccessful: vi.fn().mockResolvedValue(null),
      loadWindow: vi.fn().mockResolvedValue({
        goal: { targetDurationMinutes: 480 },
        days: [],
      }),
    } as unknown as AnalysisRepository;

    const viewModel = await getAnalyzeViewModel(scope, {
      clock: { now: () => new Date("2026-08-20T00:00:00.000Z") },
      getPrisma: () => ({} as never),
      createAnalysisRepository: () => analysisRepository,
      createPlannerRepository: () => plannerRepository,
    });

    expect(viewModel.scheduleAdvice).toMatchObject({
      id: "reroute-advice",
      triggerType: "reroute",
      status: "generated",
    });
    expect(plannerRepository.listEvents).toHaveBeenCalledOnce();
    expect(plannerRepository.findLatestGeneratedAdvice).toHaveBeenCalledOnce();
  });
});
