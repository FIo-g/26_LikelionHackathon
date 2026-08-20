import { describe, expect, it, vi } from "vitest";

import { evaluateRerouting } from "@/modules/planner/application/evaluate-rerouting";
import type { PlannerRepository } from "@/modules/planner/application/ports";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

const activeDay = {
  id: "day-1",
  planId: "plan-1",
  localDate: "2026-08-22",
  targetBedAt: "2026-08-22T15:00:00.000Z",
  targetWakeAt: "2026-08-22T23:00:00.000Z",
  caffeineCutoffAt: "2026-08-22T08:00:00.000Z",
  exerciseCutoffAt: "2026-08-22T11:00:00.000Z",
  mealCutoffAt: "2026-08-22T12:00:00.000Z",
  windDownAt: "2026-08-22T14:00:00.000Z",
  status: "active" as const,
};

describe("evaluateRerouting", () => {
  it("supersedes stale generated advice and persists one reroute proposal for a cutoff-crossing record", async () => {
    const saveGeneratedAdvice = vi.fn(async () => ({ adviceId: "reroute-1" }));
    const supersedeGeneratedAdvice = vi.fn(async () => undefined);
    const repository: PlannerRepository = {
      createEvent: async () => ({ eventId: "event-1" }),
      saveGeneratedAdvice,
      findAdvice: async () => null,
      findCurrentGoal: async () => ({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }),
      findCurrentBaseline: async () => null,
      findActivePlan: async () => ({ id: "plan-1", status: "active" }),
      listActiveDays: async () => [activeDay],
      listEvents: async () => [],
      findLatestGeneratedAdvice: async () => null,
      findLatestDismissedAdvice: async () => null,
      findPlanForEvent: async () => null,
      acceptAdvice: async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] }),
      dismissAdvice: async () => undefined,
      supersedeGeneratedAdvice,
    };

    const record = {
      id: "caffeine-1",
      userId: scope.userId,
      localDate: "2026-08-22",
      input: {
        type: "caffeine",
        brand: "테스트",
        product: "커피",
        caffeineMg: 120,
        consumedAt: new Date("2026-08-22T12:30:00.000Z"),
        timezone: "Asia/Seoul",
      },
    };
    const result = await evaluateRerouting(scope, repository, [record], { clock: { now: () => new Date("2026-08-22T10:00:00.000Z") } });

    expect(supersedeGeneratedAdvice).toHaveBeenCalledWith("plan-1");
    expect(saveGeneratedAdvice).toHaveBeenCalledWith(expect.objectContaining({
      planId: "plan-1",
      triggerType: "reroute",
      inputSnapshot: expect.objectContaining({ triggerRecordId: "caffeine-1", event: null, rerouteRecords: [expect.objectContaining({ id: "caffeine-1" })] }),
    }));
    expect(result?.adviceId).toBe("reroute-1");
  });

  it("changes the advice hash when the final triggering record content changes", async () => {
    const saved: string[] = [];
    const repository = {
      createEvent: async () => ({ eventId: "event-1" }), saveGeneratedAdvice: async (input: { inputHash: string }) => { saved.push(input.inputHash); return { adviceId: "reroute-1" }; },
      findAdvice: async () => null, findCurrentGoal: async () => ({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }), findCurrentBaseline: async () => null,
      findActivePlan: async () => ({ id: "plan-1", status: "active" as const }), listActiveDays: async () => [activeDay], listEvents: async () => [], findLatestGeneratedAdvice: async () => null,
      findLatestDismissedAdvice: async () => null, findPlanForEvent: async () => null, acceptAdvice: async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] }),
      dismissAdvice: async () => undefined, supersedeGeneratedAdvice: async () => undefined,
    } satisfies PlannerRepository;
    const makeRecord = (caffeineMg: number) => ({ id: "caffeine-1", userId: scope.userId, localDate: "2026-08-22", input: { type: "caffeine" as const, brand: "테스트", product: "커피", caffeineMg, consumedAt: new Date("2026-08-22T12:30:00.000Z"), timezone: "Asia/Seoul" } });

    await evaluateRerouting(scope, repository, [makeRecord(120)], { clock: { now: () => new Date("2026-08-22T10:00:00.000Z") } });
    await evaluateRerouting(scope, repository, [makeRecord(200)], { clock: { now: () => new Date("2026-08-22T10:00:00.000Z") } });

    expect(saved[0]).not.toBe(saved[1]);
  });

  it("reuses matching generated advice without superseding or inserting a duplicate", async () => {
    const saveGeneratedAdvice = vi.fn(async () => ({ adviceId: "reroute-1" }));
    const supersedeGeneratedAdvice = vi.fn(async () => undefined);
    const records = [{ recordId: "caffeine-1", input: { type: "caffeine" as const, brand: "테스트", product: "커피", caffeineMg: 120, consumedAt: new Date("2026-08-22T12:30:00.000Z"), timezone: "Asia/Seoul" } }];
    const repository = {
      createEvent: async () => ({ eventId: "event-1" }), saveGeneratedAdvice, findAdvice: async () => null,
      findCurrentGoal: async () => ({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }), findCurrentBaseline: async () => null,
      findActivePlan: async () => ({ id: "plan-1", status: "active" as const }), listActiveDays: async () => [activeDay], listEvents: async () => [],
      findLatestGeneratedAdvice: async () => null, findLatestDismissedAdvice: async () => null, findPlanForEvent: async () => null,
      acceptAdvice: async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] }), dismissAdvice: async () => undefined,
      supersedeGeneratedAdvice,
      findAdviceByInputHash: async () => ({ id: "reroute-existing", status: "generated" as const }),
    } satisfies PlannerRepository;

    const result = await evaluateRerouting(scope, repository, records, { clock: { now: () => new Date("2026-08-22T10:00:00.000Z") } });

    expect(result).toEqual({ adviceId: "reroute-existing" });
    expect(supersedeGeneratedAdvice).not.toHaveBeenCalled();
    expect(saveGeneratedAdvice).not.toHaveBeenCalled();
  });

  it("selects a remaining cutoff violation from the final record set after a delete", async () => {
    const saved: Array<{ inputSnapshot: { triggerRecordId: string } }> = [];
    const repository = {
      createEvent: async () => ({ eventId: "event-1" }), saveGeneratedAdvice: async (input: { inputSnapshot: { triggerRecordId: string } }) => { saved.push(input); return { adviceId: "reroute-2" }; }, findAdvice: async () => null,
      findCurrentGoal: async () => ({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }), findCurrentBaseline: async () => null,
      findActivePlan: async () => ({ id: "plan-1", status: "active" as const }), listActiveDays: async () => [activeDay], listEvents: async () => [],
      findLatestGeneratedAdvice: async () => null, findLatestDismissedAdvice: async () => null, findPlanForEvent: async () => null,
      acceptAdvice: async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] }), dismissAdvice: async () => undefined,
      supersedeGeneratedAdvice: async () => undefined,
    } satisfies PlannerRepository;

    await evaluateRerouting(scope, repository, [{ recordId: "remaining-caffeine", input: { type: "caffeine", brand: "테스트", product: "커피", caffeineMg: 120, consumedAt: new Date("2026-08-22T12:30:00.000Z"), timezone: "Asia/Seoul" } }], { clock: { now: () => new Date("2026-08-22T10:00:00.000Z") } });

    expect(saved[0]?.inputSnapshot.triggerRecordId).toBe("remaining-caffeine");
  });

  it("reactivates superseded advice A after the final record set changes A to B and back to A", async () => {
    const adviceByHash = new Map<string, { id: string; status: "generated" | "superseded" }>();
    let sequence = 0;
    const repository = {
      createEvent: async () => ({ eventId: "event-1" }),
      saveGeneratedAdvice: async (input: { inputHash: string }) => {
        const id = `advice-${++sequence}`;
        adviceByHash.set(input.inputHash, { id, status: "generated" });
        return { adviceId: id };
      },
      findAdvice: async () => null,
      findAdviceByInputHash: async (inputHash: string) => adviceByHash.get(inputHash) ?? null,
      findCurrentGoal: async () => ({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }),
      findCurrentBaseline: async () => null,
      findActivePlan: async () => ({ id: "plan-1", status: "active" as const }), listActiveDays: async () => [activeDay], listEvents: async () => [],
      findLatestGeneratedAdvice: async () => null, findLatestDismissedAdvice: async () => null, findPlanForEvent: async () => null,
      acceptAdvice: async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] }), dismissAdvice: async () => undefined,
      supersedeGeneratedAdvice: async () => { adviceByHash.forEach((advice) => { if (advice.status === "generated") advice.status = "superseded"; }); },
      reactivateAdvice: async (adviceId: string) => { adviceByHash.forEach((advice) => { if (advice.id === adviceId) advice.status = "generated"; }); },
    } satisfies PlannerRepository;
    const records = (caffeineMg: number) => [{ recordId: "caffeine-1", input: { type: "caffeine" as const, brand: "테스트", product: "커피", caffeineMg, consumedAt: new Date("2026-08-22T12:30:00.000Z"), timezone: "Asia/Seoul" } }];
    const dependencies = { clock: { now: () => new Date("2026-08-22T13:00:00.000Z") } };

    const first = await evaluateRerouting(scope, repository, records(120), dependencies);
    await evaluateRerouting(scope, repository, records(200), dependencies);
    const restored = await evaluateRerouting(scope, repository, records(120), dependencies);

    expect(restored).toEqual(first);
    expect([...adviceByHash.values()].filter((advice) => advice.status === "generated")).toEqual([{ id: first?.adviceId, status: "generated" }]);
  });
});
