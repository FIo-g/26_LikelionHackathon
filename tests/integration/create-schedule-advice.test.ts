import { describe, expect, it, vi } from "vitest";

import { createScheduleAdviceService } from "@/modules/planner/application/create-schedule-advice";
import type { PlannerRepository } from "@/modules/planner/application/ports";
import type { ScheduleAdviceEntity } from "@/modules/planner/domain/types";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };
const now = new Date("2026-08-20T00:00:00.000Z");

const createRepository = () => {
  const advice = new Map<string, ScheduleAdviceEntity>();
  const events: Array<{ id: string; title: string; type: string; startsAt: string }> = [];

  const repository: PlannerRepository = {
    createEvent: async (input) => {
      const eventId = `event-${events.length + 1}`;
      events.push({ id: eventId, title: input.title, type: input.type, startsAt: input.startsAt });
      return { eventId };
    },
    saveGeneratedAdvice: async (input) => {
      const adviceId = `advice-${advice.size + 1}`;
      advice.set(adviceId, { ...input, id: adviceId, status: "generated" });
      return { adviceId };
    },
    findAdvice: async (adviceId) => advice.get(adviceId) ?? null,
    findActivePlan: async () => null,
    listActiveDays: async () => [],
    acceptAdvice: async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] }),
    dismissAdvice: async () => undefined,
    supersedeGeneratedAdvice: async () => undefined,
    findCurrentGoal: async () => ({
      targetBedTime: "23:00",
      targetWakeTime: "07:00",
      targetDurationMinutes: 480,
    }),
    findCurrentBaseline: async () => null,
    listEvents: async () => events.map(({ id, title, type, startsAt }) => ({ id, title, type, startsAt })),
    findLatestGeneratedAdvice: async () => [...advice.values()].find((item) => item.status === "generated") ?? null,
    findLatestDismissedAdvice: async () => null,
    findPlanForEvent: async () => null,
  };

  return { repository, events };
};

describe("create schedule advice", () => {
  it("creates an event and generated advice without creating a plan", async () => {
    const fixture = createRepository();
    const service = createScheduleAdviceService(scope, {
      clock: { now: () => now },
      executeTransaction: async (work) => work(),
      createPlannerRepository: () => fixture.repository,
      createMutationReceiptRepository: () => ({ execute: async (_command, work) => work() }),
      narrationDependencies: null,
    });

    const result = await service.createScheduleAdvice({
      idempotencyKey: "event-advice-1",
      title: "아침 비행",
      type: "travel",
      startsAt: "2026-08-22T00:00:00.000Z",
      desiredWakeAt: "2026-08-21T19:00:00.000Z",
      notes: "공항 이동",
    });

    expect(await fixture.repository.findAdvice(result.adviceId)).toMatchObject({ status: "generated" });
    expect(await fixture.repository.findPlanForEvent(result.eventId)).toBeNull();
    expect(fixture.events).toHaveLength(1);
  });

  it("does not open the default database when narration is explicitly disabled", async () => {
    const fixture = createRepository();
    const getPrisma = vi.fn(() => {
      throw new Error("DEFAULT_DATABASE_OPENED");
    });
    const service = createScheduleAdviceService(scope, {
      clock: { now: () => now },
      getPrisma,
      executeTransaction: async (work) => work(),
      createPlannerRepository: () => fixture.repository,
      createMutationReceiptRepository: () => ({ execute: async (_command, work) => work() }),
      narrationDependencies: null,
    });

    await expect(service.createScheduleAdvice({
      idempotencyKey: "event-advice-without-narration",
      title: "아침 비행",
      type: "travel",
      startsAt: "2026-08-22T00:00:00.000Z",
      desiredWakeAt: "2026-08-21T19:00:00.000Z",
      notes: null,
    })).resolves.toMatchObject({ eventId: "event-1", adviceId: "advice-1" });
    expect(getPrisma).not.toHaveBeenCalled();
  });
});
