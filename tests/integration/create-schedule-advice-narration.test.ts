import { describe, expect, it, vi } from "vitest";
import { createScheduleAdviceService } from "@/modules/planner/application/create-schedule-advice";
import type { PlannerRepository } from "@/modules/planner/application/ports";
import type { MutationReceiptRepository } from "@/modules/records/application/ports";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import type { TransactionClient } from "@/shared/db/transaction";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

describe("event advice narration queue", () => {
  it("does not dispatch a duplicate narration when an idempotent advice request replays", async () => {
    let cached: unknown;
    const narration: NarrationRepository = {
      createPending: vi.fn()
        .mockResolvedValueOnce({ narrationId: "narration-1", created: true })
        .mockResolvedValueOnce({ narrationId: "narration-1", created: false }),
      markReady: vi.fn(async () => undefined),
      markFallback: vi.fn(async () => undefined),
      recoverStalePending: vi.fn(async () => 0),
      retry: vi.fn(async () => null),
      findForAnalysisSnapshot: vi.fn(async () => null),
    };
    const planner: PlannerRepository = {
      findCurrentGoal: vi.fn().mockResolvedValue({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }),
      findCurrentBaseline: vi.fn().mockResolvedValue(null),
      createEvent: vi.fn().mockResolvedValue({ eventId: "event-1" }),
      saveGeneratedAdvice: vi.fn().mockResolvedValue({ adviceId: "advice-1" }),
      findAdvice: vi.fn(async () => null),
      findActivePlan: vi.fn(async () => null),
      listActiveDays: vi.fn(async () => []),
      listEvents: vi.fn(async () => []),
      findLatestGeneratedAdvice: vi.fn(async () => null),
      findLatestDismissedAdvice: vi.fn(async () => null),
      findPlanForEvent: vi.fn(async () => null),
      acceptAdvice: vi.fn(async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] })),
      dismissAdvice: vi.fn(async () => undefined),
      supersedeGeneratedAdvice: vi.fn(async () => undefined),
    };
    const receipts: MutationReceiptRepository = {
      execute: async <T>(_command: Parameters<MutationReceiptRepository["execute"]>[0], work: () => Promise<T>): Promise<T> => {
        if (cached !== undefined) return cached as T;
        const response = await work();
        cached = response;
        return response;
      },
    };
    const transaction = { narration: {} } as unknown as TransactionClient;
    const service = createScheduleAdviceService(scope, {
      clock: { now: () => new Date("2026-08-20T00:00:00.000Z") },
      executeTransaction: async (work) => work(transaction),
      createPlannerRepository: () => planner,
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
