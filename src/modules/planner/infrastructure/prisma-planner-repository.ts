import { Temporal } from "@js-temporal/polyfill";

import type { TransactionClient } from "@/shared/db/transaction";
import type { UserScope } from "@/shared/domain/contracts";
import { assertJsonSize } from "@/shared/validation/versioned-json";
import { createPlannerInputHash } from "../domain/generate-schedule-proposal";
import {
  generatedAdviceInputSchema,
  planDayTargetSchema,
  scheduleProposalSchema,
  specialEventInputSchema,
  storedGeneratedAdviceInputSchema,
} from "../domain/schemas";
import type { PlanDayEntity, ScheduleAdviceEntity, SleepPlanEntity } from "../domain/types";
import type { PlannerRepository } from "../application/ports";
import { diffScheduleProposal } from "../domain/diff-schedule-proposal";

type DbPayload = Record<string, unknown>;

type PrismaPlannerClient = TransactionClient & {
  specialEvent: {
    create: (args: unknown) => Promise<{ id: string }>;
    findMany: (args: unknown) => Promise<DbPayload[]>;
  };
  scheduleAdvice: {
    create: (args: unknown) => Promise<{ id: string }>;
    findFirst: (args: unknown) => Promise<DbPayload | null>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
  };
  sleepPlan: {
    findFirst: (args: unknown) => Promise<DbPayload | null>;
    create: (args: unknown) => Promise<{ id: string }>;
    updateMany: (args: unknown) => Promise<unknown>;
  };
  planDay: {
    findMany: (args: unknown) => Promise<DbPayload[]>;
    createMany: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
  };
  planRevision: {
    create: (args: unknown) => Promise<{ id: string }>;
    findFirst: (args: unknown) => Promise<DbPayload | null>;
  };
  sleepGoal: {
    findUnique: (args: unknown) => Promise<DbPayload | null>;
  };
  baselineSnapshot: {
    findFirst: (args: unknown) => Promise<DbPayload | null>;
  };
  $transaction: <T>(callback: (transaction: PrismaPlannerClient) => Promise<T>) => Promise<T>;
};

const asPlannerClient = (db: TransactionClient): PrismaPlannerClient => db as PrismaPlannerClient;
const toStringValue = (value: unknown): string => String(value);
const toInstant = (value: unknown): string => (value instanceof Date ? value : new Date(String(value))).toISOString();

const mapAdvice = (row: DbPayload): ScheduleAdviceEntity => {
  const input = storedGeneratedAdviceInputSchema.parse({
    eventId: row.eventId ?? null,
    planId: row.planId ?? null,
    triggerType: row.triggerType,
    inputHash: row.inputHash,
    inputSnapshot: row.inputSnapshot,
    proposal: row.proposal,
  });
  const status = row.status;
  if (status !== "generated" && status !== "accepted" && status !== "dismissed" && status !== "superseded" && status !== "failed") {
    throw new Error("CORRUPT_PLANNER_ADVICE");
  }
  return { ...input, id: toStringValue(row.id), status };
};

const mapPlanDay = (row: DbPayload): PlanDayEntity => ({
  id: toStringValue(row.id),
  planId: toStringValue(row.planId),
  localDate: toStringValue(row.localDate),
  targetBedAt: toInstant(row.targetBedAt),
  targetWakeAt: toInstant(row.targetWakeAt),
  caffeineCutoffAt: toInstant(row.caffeineCutoffAt),
  exerciseCutoffAt: toInstant(row.exerciseCutoffAt),
  mealCutoffAt: toInstant(row.mealCutoffAt),
  windDownAt: toInstant(row.windDownAt),
  status: toStringValue(row.status) as PlanDayEntity["status"],
});

const parseSnapshotDays = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray((snapshot as { days?: unknown }).days)) {
    throw new Error("CORRUPT_PLAN_REVISION");
  }
  return (snapshot as { days: unknown[] }).days.map((day) => planDayTargetSchema.parse(day));
};

export const createPrismaPlannerRepository = (
  db: TransactionClient,
  scope: UserScope,
): PlannerRepository => {
  const client = asPlannerClient(db);

  return {
    createEvent: async (input) => {
      const parsed = specialEventInputSchema.parse(input);
      const startsAt = Temporal.Instant.from(parsed.startsAt);
      const localDate = startsAt.toZonedDateTimeISO(parsed.timezone).toPlainDate().toString();
      const event = await client.specialEvent.create({
        data: {
          userId: scope.userId,
          title: parsed.title,
          type: parsed.type,
          startsAt: new Date(parsed.startsAt),
          localDate,
          desiredWakeAt: parsed.desiredWakeAt ? new Date(parsed.desiredWakeAt) : null,
          notes: parsed.notes,
          timezone: parsed.timezone,
        },
      });
      return { eventId: event.id };
    },
    saveGeneratedAdvice: async (input) => {
      const parsed = generatedAdviceInputSchema.parse(input);
      if (parsed.inputHash !== createPlannerInputHash(parsed.inputSnapshot)) {
        throw new Error("INVALID_PLANNER_INPUT_HASH");
      }
      assertJsonSize(parsed.inputSnapshot);
      assertJsonSize(parsed.proposal);
      const advice = await client.scheduleAdvice.create({
        data: {
          userId: scope.userId,
          eventId: parsed.eventId,
          planId: parsed.planId,
          triggerType: parsed.triggerType,
          status: "generated",
          algorithmVersion: parsed.proposal.algorithmVersion,
          inputHash: parsed.inputHash,
          inputSnapshot: parsed.inputSnapshot,
          proposal: parsed.proposal,
          confidence: parsed.proposal.confidence,
        },
      });
      return { adviceId: advice.id };
    },
    findAdvice: async (adviceId) => {
      const advice = await client.scheduleAdvice.findFirst({
        where: { id: adviceId, userId: scope.userId },
      });
      return advice ? mapAdvice(advice) : null;
    },
    findAdviceByInputHash: async (inputHash) => {
      const advice = await client.scheduleAdvice.findFirst({
        where: { userId: scope.userId, inputHash },
        select: { id: true, status: true },
      });
      if (!advice) return null;
      const status = toStringValue(advice.status);
      if (status !== "generated" && status !== "accepted" && status !== "dismissed" && status !== "superseded" && status !== "failed") {
        throw new Error("CORRUPT_PLANNER_ADVICE");
      }
      return { id: toStringValue(advice.id), status };
    },
    reactivateAdvice: async (adviceId, planId) => {
      await client.scheduleAdvice.updateMany({
        where: { id: adviceId, planId, userId: scope.userId, status: "superseded" },
        data: { status: "generated" },
      });
    },
    findCurrentGoal: async () => {
      const goal = await client.sleepGoal.findUnique({
        where: { userId: scope.userId },
        select: {
          targetBedTime: true,
          targetWakeTime: true,
          targetDurationMinutes: true,
        },
      });
      return goal ? {
        targetBedTime: toStringValue(goal.targetBedTime),
        targetWakeTime: toStringValue(goal.targetWakeTime),
        targetDurationMinutes: Number(goal.targetDurationMinutes),
      } : null;
    },
    findCurrentBaseline: async () => {
      const baseline = await client.baselineSnapshot.findFirst({
        where: { userId: scope.userId, timezone: scope.timezone, status: "current" },
        orderBy: { generatedAt: "desc" },
        select: { id: true, status: true, result: true },
      });
      return baseline ? {
        id: toStringValue(baseline.id),
        status: toStringValue(baseline.status),
        result: baseline.result,
      } : null;
    },
    findActivePlan: async () => {
      const plan = await client.sleepPlan.findFirst({
        where: { userId: scope.userId, status: "active" },
        select: {
          id: true,
          status: true,
          activeKey: true,
          revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
        },
      });
      const revision = Array.isArray(plan?.revisions) ? plan.revisions[0] as DbPayload | undefined : undefined;
      return plan ? {
        id: toStringValue(plan.id),
        status: "active",
        activeKey: plan.activeKey === null || plan.activeKey === undefined ? null : toStringValue(plan.activeKey),
        revisionId: revision ? toStringValue(revision.id) : null,
      } satisfies SleepPlanEntity : null;
    },
    listActiveDays: async (planId) => {
      const rows = await client.planDay.findMany({
        where: { planId, userId: scope.userId, status: "active" },
        orderBy: { localDate: "asc" },
      });
      return rows.map(mapPlanDay);
    },
    listEvents: async () => {
      const events = await client.specialEvent.findMany({
        where: { userId: scope.userId },
        orderBy: { startsAt: "asc" },
        select: { id: true, type: true, startsAt: true },
      });
      return events.map((event) => ({
        id: toStringValue(event.id),
        type: toStringValue(event.type),
        startsAt: toInstant(event.startsAt),
      }));
    },
    findLatestGeneratedAdvice: async () => {
      const advice = await client.scheduleAdvice.findFirst({
        where: { userId: scope.userId, status: "generated" },
        orderBy: { generatedAt: "desc" },
      });
      return advice ? mapAdvice(advice) : null;
    },
    findLatestDismissedAdvice: async () => {
      const advice = await client.scheduleAdvice.findFirst({
        where: { userId: scope.userId, status: "dismissed" },
        orderBy: { generatedAt: "desc" },
      });
      return advice ? mapAdvice(advice) : null;
    },
    findPlanForEvent: async (eventId) => {
      const revision = await client.planRevision.findFirst({
        where: { userId: scope.userId, triggerEntityType: "special-event", triggerEntityId: eventId },
        orderBy: { createdAt: "desc" },
        select: { id: true, planId: true },
      });
      if (!revision) {
        return null;
      }
      const plan = await client.sleepPlan.findFirst({
        where: { id: revision.planId, userId: scope.userId },
      });
      return plan ? {
        id: toStringValue(plan.id),
        status: toStringValue(plan.status) as SleepPlanEntity["status"],
        activeKey: plan.activeKey === null || plan.activeKey === undefined ? null : toStringValue(plan.activeKey),
        revisionId: toStringValue(revision.id),
      } : null;
    },
    acceptAdvice: async (input) => {
      const rawAdvice = await client.scheduleAdvice.findFirst({
        where: { id: input.adviceId, userId: scope.userId },
      });
      if (!rawAdvice) throw new Error("PLANNER_ADVICE_NOT_FOUND");
      const advice = mapAdvice(rawAdvice);
      const existingRevision = advice.status === "accepted"
        ? await client.planRevision.findFirst({ where: { userId: scope.userId, sourceAdviceId: advice.id } })
        : null;
      if (existingRevision) {
        const before = parseSnapshotDays(existingRevision.beforeSnapshot);
        const after = parseSnapshotDays(existingRevision.afterSnapshot);
        return {
          planId: toStringValue(existingRevision.planId),
          revisionId: toStringValue(existingRevision.id),
          changedDates: diffScheduleProposal(before, after).map((change) => change.localDate),
        };
      }
      if (advice.status !== "generated") throw new Error("PLANNER_ADVICE_NOT_AVAILABLE");

      const activePlan = await client.sleepPlan.findFirst({
        where: { userId: scope.userId, status: "active" },
      });
      const plan = activePlan ?? await client.sleepPlan.create({
        data: { userId: scope.userId, timezone: advice.inputSnapshot.timezone, status: "active", activeKey: scope.userId },
      });
      const oldFutureRows = await client.planDay.findMany({
        where: { userId: scope.userId, planId: plan.id, status: "active", localDate: { gte: input.effectiveLocalDate } },
      });
      const before = oldFutureRows.map(mapPlanDay);
      const after = advice.proposal.days.filter((day) => day.localDate >= input.effectiveLocalDate);
      if (after.length === 0) throw new Error("PLANNER_ADVICE_HAS_NO_FUTURE_DAYS");
      const diff = diffScheduleProposal(before, after);
      const beforeSnapshot = { schemaVersion: 1 as const, days: before };
      const afterSnapshot = { schemaVersion: 1 as const, days: after };
      assertJsonSize(beforeSnapshot);
      assertJsonSize(afterSnapshot);

      await client.planDay.updateMany({
        where: { userId: scope.userId, planId: plan.id, status: "active", localDate: { gte: input.effectiveLocalDate } },
        data: { status: "superseded", activeKey: null },
      });
      await client.planDay.createMany({
        data: after.map((day) => ({
          userId: scope.userId,
          planId: plan.id,
          localDate: day.localDate,
          timezone: advice.inputSnapshot.timezone,
          targetBedAt: new Date(day.targetBedAt),
          targetWakeAt: new Date(day.targetWakeAt),
          caffeineCutoffAt: new Date(day.caffeineCutoffAt),
          exerciseCutoffAt: new Date(day.exerciseCutoffAt),
          mealCutoffAt: new Date(day.mealCutoffAt),
          windDownAt: new Date(day.windDownAt),
          status: "active",
          activeKey: `${plan.id}:${day.localDate}`,
        })),
      });
      await client.scheduleAdvice.update({ where: { id: advice.id }, data: { status: "accepted" } });
      await client.scheduleAdvice.updateMany({
        where: { userId: scope.userId, status: "generated", id: { not: advice.id } },
        data: { status: "superseded" },
      });
      const revision = await client.planRevision.create({
        data: {
          userId: scope.userId,
          planId: plan.id,
          triggerType: advice.triggerType,
          triggerEntityType: advice.triggerType === "event" ? "special-event" : "schedule-advice",
          triggerEntityId: advice.triggerType === "event" ? advice.eventId : advice.id,
          sourceAdviceId: advice.id,
          beforeSnapshot,
          afterSnapshot,
          reason: "advice-accepted",
        },
      });
      return { planId: plan.id, revisionId: revision.id, changedDates: diff.map((change) => change.localDate) };
    },
    dismissAdvice: async (adviceId) => {
      await client.scheduleAdvice.updateMany({
        where: { id: adviceId, userId: scope.userId, status: "generated" },
        data: { status: "dismissed" },
      });
    },
    supersedeGeneratedAdvice: async (planId) => {
      await client.scheduleAdvice.updateMany({
        where: { planId, userId: scope.userId, status: "generated" },
        data: { status: "superseded" },
      });
    },
  };
};

export const parseStoredScheduleProposal = (value: unknown) => scheduleProposalSchema.parse(value);
