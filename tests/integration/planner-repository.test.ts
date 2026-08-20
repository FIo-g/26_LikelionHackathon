import { describe, expect, it } from "vitest";

import type { GeneratedAdviceInput, PlanDayTarget } from "@/modules/planner/application/ports";
import { createPrismaPlannerRepository } from "@/modules/planner/infrastructure/prisma-planner-repository";
import { createPlannerInputHash } from "@/modules/planner/domain/generate-schedule-proposal";

type AdviceRow = GeneratedAdviceInput & {
  id: string;
  userId: string;
  status: "generated" | "accepted" | "dismissed" | "superseded" | "failed";
  generatedAt: Date;
};

const day: PlanDayTarget = {
  localDate: "2026-09-12",
  targetBedAt: "2026-09-11T14:00:00.000Z",
  targetWakeAt: "2026-09-11T22:00:00.000Z",
  caffeineCutoffAt: "2026-09-11T06:00:00.000Z",
  exerciseCutoffAt: "2026-09-11T12:00:00.000Z",
  mealCutoffAt: "2026-09-11T11:00:00.000Z",
  windDownAt: "2026-09-11T13:00:00.000Z",
};

const createAdviceInput = (): GeneratedAdviceInput => {
  const inputSnapshot = {
    schemaVersion: 1 as const,
    timezone: "Asia/Seoul",
    goal: {
      targetBedTime: "23:00",
      targetWakeTime: "07:00",
      targetDurationMinutes: 480,
    },
    baselineId: null,
    event: {
      id: "event-1",
      type: "travel",
      startsAt: "2026-09-12T00:00:00.000Z",
      desiredWakeAt: "2026-09-11T19:00:00.000Z",
    },
    planId: null,
    triggerRecordId: null,
  };

  return {
    eventId: "event-1",
    planId: null,
    triggerType: "event",
    inputHash: createPlannerInputHash(inputSnapshot),
    inputSnapshot,
    proposal: {
      adjustmentStartsOn: "2026-09-12",
      eventWakeAt: day.targetWakeAt,
      days: [day],
      conflicts: [],
      confidence: "low",
      evidence: [],
      algorithmVersion: "provisional-v1",
    },
  };
};

const createLegacyRerouteAdviceInput = (): GeneratedAdviceInput => {
  const inputSnapshot: GeneratedAdviceInput["inputSnapshot"] = {
    schemaVersion: 1,
    timezone: "Asia/Seoul",
    goal: {
      targetBedTime: "23:00",
      targetWakeTime: "07:00",
      targetDurationMinutes: 480,
    },
    baselineId: null,
    event: null,
    planId: "plan-legacy",
    triggerRecordId: "caffeine-legacy",
    rerouteRecords: [{
      id: "caffeine-legacy",
      type: "caffeine",
      input: {
        type: "caffeine",
        brand: "테스트",
        product: "커피",
        caffeineMg: 120,
        consumedAt: "2026-09-11T12:30:00.000Z",
        timezone: "Asia/Seoul",
      },
    }],
  };

  return {
    eventId: null,
    planId: "plan-legacy",
    triggerType: "reroute",
    inputHash: createPlannerInputHash(inputSnapshot),
    inputSnapshot,
    proposal: {
      adjustmentStartsOn: day.localDate,
      eventWakeAt: day.targetWakeAt,
      days: [day],
      conflicts: [],
      confidence: "low",
      evidence: [],
      algorithmVersion: "provisional-v1",
    },
  };
};

const createMockPlannerDb = () => {
  const state = {
    advice: [] as AdviceRow[],
    plans: [] as Array<Record<string, unknown>>,
    days: [] as Array<Record<string, unknown>>,
    revisions: [] as Array<Record<string, unknown>>,
  };
  let sequence = 1;
  const nextId = (prefix: string) => `${prefix}-${sequence++}`;

  const db = {
    scheduleAdvice: {
      create: async ({ data }: { data: Omit<AdviceRow, "id" | "generatedAt"> }) => {
        const row: AdviceRow = { ...data, id: nextId("advice"), generatedAt: new Date("2026-08-20T00:00:00.000Z") };
        state.advice.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string; status?: AdviceRow["status"] } }) => (
        state.advice.find((row) => row.id === where.id && row.userId === where.userId
          && (where.status === undefined || row.status === where.status)) ?? null
      ),
      updateMany: async ({ where, data }: { where: Partial<AdviceRow>; data: Partial<AdviceRow> }) => {
        const rows = state.advice.filter((row) => Object.entries(where).every(([key, value]) => row[key as keyof AdviceRow] === value));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<AdviceRow> }) => {
        const row = state.advice.find((item) => item.id === where.id);
        if (!row) throw new Error("ADVICE_NOT_FOUND");
        Object.assign(row, data);
        return row;
      },
    },
    sleepPlan: {
      findFirst: async ({ where }: { where: { userId: string; status: string } }) => (
        state.plans.find((plan) => plan.userId === where.userId && plan.status === where.status) ?? null
      ),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        state.plans.filter((plan) => Object.entries(where).every(([key, value]) => plan[key] === value))
          .forEach((plan) => Object.assign(plan, data));
        return { count: 0 };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: nextId("plan") };
        state.plans.push(row);
        return row;
      },
    },
    planDay: {
      findMany: async ({ where }: { where: { planId: string; userId: string; status: string } }) => (
        state.days.filter((row) => row.planId === where.planId && row.userId === where.userId && row.status === where.status)
      ),
      updateMany: async () => ({ count: 0 }),
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        state.days.push(...data);
        return { count: data.length };
      },
    },
    planRevision: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: nextId("revision") };
        state.revisions.push(row);
        return row;
      },
    },
    $transaction: async <T>(callback: (transaction: typeof db) => Promise<T>): Promise<T> => callback(db),
  };

  return { db, state };
};

describe("prisma planner repository", () => {
  it("reads a legacy reroute advice that predates canonical plan identity fields", async () => {
    const fixture = createMockPlannerDb();
    const repository = createPrismaPlannerRepository(fixture.db as never, { userId: "alice", timezone: "Asia/Seoul" });
    fixture.state.advice.push({
      ...createLegacyRerouteAdviceInput(),
      id: "advice-legacy",
      userId: "alice",
      status: "generated",
      generatedAt: new Date("2026-08-20T00:00:00.000Z"),
    });

    await expect(repository.findAdvice("advice-legacy")).resolves.toMatchObject({
      id: "advice-legacy",
      triggerType: "reroute",
      inputSnapshot: { planId: "plan-legacy", triggerRecordId: "caffeine-legacy" },
    });
  });

  it("still rejects a new reroute write without canonical plan identity fields", async () => {
    const fixture = createMockPlannerDb();
    const repository = createPrismaPlannerRepository(fixture.db as never, { userId: "alice", timezone: "Asia/Seoul" });

    await expect(repository.saveGeneratedAdvice(createLegacyRerouteAdviceInput())).rejects.toThrow();
  });

  it("does not expose or mutate another user's generated advice", async () => {
    const fixture = createMockPlannerDb();
    const alice = createPrismaPlannerRepository(fixture.db as never, { userId: "alice", timezone: "Asia/Seoul" });
    const bob = createPrismaPlannerRepository(fixture.db as never, { userId: "bob", timezone: "Asia/Seoul" });

    const { adviceId } = await alice.saveGeneratedAdvice(createAdviceInput());

    await expect(bob.findAdvice(adviceId)).resolves.toBeNull();
    await bob.dismissAdvice(adviceId);

    await expect(alice.findAdvice(adviceId)).resolves.toMatchObject({ status: "generated" });
  });

  it("accepts scoped generated advice into one active plan and revision", async () => {
    const fixture = createMockPlannerDb();
    const repository = createPrismaPlannerRepository(fixture.db as never, { userId: "alice", timezone: "Asia/Seoul" });
    const { adviceId } = await repository.saveGeneratedAdvice(createAdviceInput());

    const result = await repository.acceptAdvice({
      adviceId,
      effectiveLocalDate: "2026-08-20",
    });

    expect(result.planId).toMatch(/^plan-/);
    expect(result.revisionId).toMatch(/^revision-/);
    await expect(repository.findActivePlan()).resolves.toMatchObject({ id: result.planId, status: "active" });
    await expect(repository.listActiveDays(result.planId)).resolves.toMatchObject([{
      localDate: day.localDate,
      targetWakeAt: day.targetWakeAt,
      status: "active",
    }]);
  });
});
