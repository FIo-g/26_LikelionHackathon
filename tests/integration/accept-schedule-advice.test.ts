import { describe, expect, it } from "vitest";

import { createAcceptScheduleAdviceService } from "@/modules/planner/application/accept-schedule-advice";
import type { PlannerRepository } from "@/modules/planner/application/ports";
import type { PlanDayTarget, ScheduleAdviceEntity } from "@/modules/planner/domain/types";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };
const now = new Date("2026-08-20T00:00:00.000Z");

const target = (localDate: string, wakeAt: string): PlanDayTarget => ({
  localDate,
  targetBedAt: `${localDate}T14:30:00.000Z`,
  targetWakeAt: `${localDate}T${wakeAt}:00.000Z`,
  caffeineCutoffAt: `${localDate}T06:30:00.000Z`,
  exerciseCutoffAt: `${localDate}T12:30:00.000Z`,
  mealCutoffAt: `${localDate}T11:30:00.000Z`,
  windDownAt: `${localDate}T13:30:00.000Z`,
});

type AcceptanceState = {
  advice: ScheduleAdviceEntity & { eventId: string | null };
  competingAdvice: { status: string };
  days: Array<PlanDayTarget & { id: string; planId: string; status: string }>;
  plans: Array<{ id: string; status: string }>;
  revisions: Array<{ id: string; planId: string; sourceAdviceId: string; before: readonly PlanDayTarget[]; after: readonly PlanDayTarget[] }>;
  receipts: Array<{ operation: string; idempotencyKey: string; response: unknown }>;
};

const createState = (): AcceptanceState => ({
  advice: {
    id: "advice-1",
    eventId: "event-1",
    planId: null,
    triggerType: "event",
    status: "generated",
    inputHash: "a".repeat(64),
    inputSnapshot: {
      schemaVersion: 1,
      timezone: "Asia/Seoul",
      goal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
      baselineId: null,
      event: { id: "event-1", type: "travel", startsAt: "2026-08-22T00:00:00.000Z", desiredWakeAt: "2026-08-21T19:00:00.000Z" },
      planId: null,
      triggerRecordId: null,
    },
    proposal: {
      adjustmentStartsOn: "2026-08-20",
      eventWakeAt: "2026-08-21T22:00:00.000Z",
      days: [target("2026-08-21", "22:15")],
      conflicts: [],
      confidence: "low",
      evidence: [],
      algorithmVersion: "provisional-v1",
    },
  },
  competingAdvice: { status: "generated" },
  plans: [{ id: "plan-1", status: "active" }],
  days: [
    { ...target("2026-08-19", "22:30"), id: "completed-day", planId: "plan-1", status: "completed" },
    { ...target("2026-08-21", "22:30"), id: "old-future-day", planId: "plan-1", status: "active" },
  ],
  revisions: [],
  receipts: [],
});

const createRepository = (state: AcceptanceState, failRevision: boolean): PlannerRepository => ({
  createEvent: async () => ({ eventId: "event-1" }),
  saveGeneratedAdvice: async () => ({ adviceId: state.advice.id }),
  findAdvice: async (adviceId) => (adviceId === state.advice.id ? state.advice : null),
  findCurrentGoal: async () => null,
  findCurrentBaseline: async () => null,
  findActivePlan: async () => state.plans.find((plan) => plan.status === "active") ?? null,
  listActiveDays: async (planId) => state.days.filter((day) => day.planId === planId && day.status === "active"),
  listEvents: async () => [],
  findLatestGeneratedAdvice: async () => null,
  findLatestDismissedAdvice: async () => null,
  findPlanForEvent: async () => null,
  acceptAdvice: async ({ adviceId, effectiveLocalDate }) => {
    if (adviceId !== state.advice.id) throw new Error("PLANNER_ADVICE_NOT_FOUND");
    const existing = state.revisions.find((revision) => revision.sourceAdviceId === adviceId);
    if (existing) return { planId: existing.planId, revisionId: existing.id, changedDates: existing.after.map((day) => day.localDate) };
    if (state.advice.status !== "generated") throw new Error("PLANNER_ADVICE_NOT_AVAILABLE");

    const before = state.days.filter((day) => day.status === "active" && day.localDate >= effectiveLocalDate);
    state.days.filter((day) => day.status === "active" && day.localDate >= effectiveLocalDate)
      .forEach((day) => { day.status = "superseded"; });
    const plan = state.plans.find((item) => item.status === "active")!;
    const after = state.advice.proposal.days.filter((day) => day.localDate >= effectiveLocalDate);
    state.days.push(...after.map((day, index) => ({ ...day, id: `new-day-${index}`, planId: plan.id, status: "active" })));
    state.advice.status = "accepted";
    state.competingAdvice.status = "superseded";
    if (failRevision) throw new Error("REVISION_INSERT_FAILED");
    const revision = { id: "revision-1", planId: plan.id, sourceAdviceId: adviceId, before, after };
    state.revisions.push(revision);
    return { planId: plan.id, revisionId: revision.id, changedDates: after.map((day) => day.localDate) };
  },
  dismissAdvice: async () => undefined,
  supersedeGeneratedAdvice: async () => undefined,
});

const createService = (state: AcceptanceState, failRevision = false) => createAcceptScheduleAdviceService(scope, {
  clock: { now: () => now },
  executeTransaction: async (work) => {
    const snapshot = structuredClone(state);
    try {
      return await work();
    } catch (error) {
      Object.assign(state, snapshot);
      throw error;
    }
  },
  createPlannerRepository: () => createRepository(state, failRevision),
  createMutationReceiptRepository: () => ({
    execute: async (command, work) => {
      const existing = state.receipts.find((receipt) => receipt.operation === command.operation && receipt.idempotencyKey === command.idempotencyKey);
      if (existing) return existing.response as Awaited<ReturnType<typeof work>>;
      const response = await work();
      state.receipts.push({ operation: command.operation, idempotencyKey: command.idempotencyKey, response });
      return response;
    },
  }),
});

describe("accept schedule advice", () => {
  it("accepts generated advice, supersedes future days, and records one immutable revision", async () => {
    const state = createState();
    const result = await createService(state).acceptScheduleAdvice({ adviceId: "advice-1", idempotencyKey: "accept-1" });

    expect(result).toEqual({ planId: "plan-1", revisionId: "revision-1", changedDates: ["2026-08-21"] });
    expect(state.advice.status).toBe("accepted");
    expect(state.competingAdvice.status).toBe("superseded");
    expect(state.days.find((day) => day.id === "old-future-day")?.status).toBe("superseded");
    expect(state.days.find((day) => day.id === "completed-day")?.status).toBe("completed");
    expect(state.days.filter((day) => day.status === "active")).toMatchObject([{ localDate: "2026-08-21", targetWakeAt: "2026-08-21T22:15:00.000Z" }]);
    expect(state.revisions).toHaveLength(1);
    expect(state.revisions[0]).toMatchObject({ sourceAdviceId: "advice-1", before: [{ localDate: "2026-08-21" }], after: [{ localDate: "2026-08-21" }] });
  });

  it("returns the original accepted revision when a browser retry uses a new key", async () => {
    const state = createState();
    const service = createService(state);

    const first = await service.acceptScheduleAdvice({ adviceId: "advice-1", idempotencyKey: "accept-1" });
    const retry = await service.acceptScheduleAdvice({ adviceId: "advice-1", idempotencyKey: "accept-2" });

    expect(retry).toEqual(first);
    expect(state.revisions).toHaveLength(1);
    expect(state.receipts).toHaveLength(2);
  });

  it("rolls back acceptance when the revision cannot be inserted", async () => {
    const state = createState();

    await expect(createService(state, true).acceptScheduleAdvice({ adviceId: "advice-1", idempotencyKey: "accept-1" }))
      .rejects.toThrow("REVISION_INSERT_FAILED");

    expect(state.advice.status).toBe("generated");
    expect(state.competingAdvice.status).toBe("generated");
    expect(state.days.find((day) => day.id === "old-future-day")?.status).toBe("active");
    expect(state.revisions).toHaveLength(0);
    expect(state.receipts).toHaveLength(0);
  });
});
