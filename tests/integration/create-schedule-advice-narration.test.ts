import { describe, expect, it, vi } from "vitest";
import { createScheduleAdviceService } from "@/modules/planner/application/create-schedule-advice";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

describe("event advice narration queue", () => {
  it("does not dispatch a duplicate narration when an idempotent advice request replays", async () => {
    let cached: unknown;
    const narration = {
      createPending: vi.fn()
        .mockResolvedValueOnce({ narrationId: "narration-1", created: true })
        .mockResolvedValueOnce({ narrationId: "narration-1", created: false }),
      markReady: vi.fn(), markFallback: vi.fn(), recoverStalePending: vi.fn(), retry: vi.fn(), findForAnalysisSnapshot: vi.fn(),
    };
    const planner = {
      findCurrentGoal: vi.fn().mockResolvedValue({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }),
      findCurrentBaseline: vi.fn().mockResolvedValue(null),
      createEvent: vi.fn().mockResolvedValue({ eventId: "event-1" }),
      saveGeneratedAdvice: vi.fn().mockResolvedValue({ adviceId: "advice-1" }),
    };
    const receipts = { execute: async (_command: unknown, work: () => Promise<unknown>) => cached ??= await work() };
    const service = createScheduleAdviceService(scope, {
      clock: { now: () => new Date("2026-08-20T00:00:00.000Z") },
      executeTransaction: async (work) => work({ narration: {} } as never),
      createPlannerRepository: () => planner as never,
      createMutationReceiptRepository: () => receipts,
      createNarrationRepository: () => narration,
      narrationDependencies: { provider: null, repository: narration },
    });
    const command = { idempotencyKey: "advice-1", title: "개인 제목", type: "travel", startsAt: "2026-08-21T00:00:00.000Z", desiredWakeAt: "2026-08-20T19:00:00.000Z", notes: "개인 메모" };

    await service.createScheduleAdvice(command);
    await service.createScheduleAdvice(command);

    expect(narration.createPending).toHaveBeenCalledTimes(2);
    expect(narration.markFallback).toHaveBeenCalledTimes(1);
  });
});
