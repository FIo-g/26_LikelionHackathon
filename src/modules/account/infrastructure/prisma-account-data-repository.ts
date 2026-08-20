import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";

import { analysisResultSchemaEnvelope } from "@/modules/analysis/domain/schemas";
import { narrationOutputSchema } from "@/modules/narration/domain/narration-schema";
import { profileSchema } from "@/modules/onboarding/domain/schemas";
import { planDayTargetSchema, storedGeneratedAdviceInputSchema } from "@/modules/planner/domain/schemas";
import type { ScheduleAdviceEntity, SleepPlanEntity } from "@/modules/planner/domain/types";
import { versionedPayloadSchema } from "@/shared/validation/versioned-json";
import type { AccountDataExportRepository } from "../application/export-user-data";
import {
  CorruptStoredPayloadError,
  recordRevisionEnvelopeSchema,
  serializedRecordSchema,
  type UserDataExport,
} from "../domain/export-schema";

type Row = Record<string, unknown>;
const asRow = (value: unknown): Row => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CorruptStoredPayloadError();
  return value as Row;
};

const string = (value: unknown): string => {
  if (typeof value !== "string" || !value) throw new CorruptStoredPayloadError();
  return value;
};

const nullableString = (value: unknown): string | null => value === null || value === undefined ? null : string(value);

const number = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new CorruptStoredPayloadError();
  return value;
};

const integer = (value: unknown): number => {
  const parsed = number(value);
  if (!Number.isInteger(parsed)) throw new CorruptStoredPayloadError();
  return parsed;
};

const iso = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) throw new CorruptStoredPayloadError();
  return date.toISOString();
};

const localDate = (value: unknown): string => {
  const parsed = string(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) throw new CorruptStoredPayloadError();
  return parsed;
};

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new CorruptStoredPayloadError();
  return result.data;
};

const record = (type: UserDataExport["records"][number]["type"], row: Row, fields: Record<string, string | number | null>, date: unknown) => parse(serializedRecordSchema, {
  id: string(row.id),
  userId: string(row.userId),
  type,
  localDate: localDate(date),
  fields,
});

const dailyLogDate = (row: Row): string => localDate(asRow(row.dailyLog).localDate);

const mapRecords = (rows: Readonly<{
  sleep: readonly Row[];
  caffeine: readonly Row[];
  alcohol: readonly Row[];
  meal: readonly Row[];
  exercise: readonly Row[];
  phoneUsage: readonly Row[];
  wellness: readonly Row[];
}>): UserDataExport["records"] => [
  ...rows.sleep.map((row) => record("sleep", row, { startedAt: iso(row.startedAt), endedAt: iso(row.endedAt), morningFatigue: integer(row.morningFatigue), timezone: string(row.timezone) }, row.sleepDate)),
  ...rows.caffeine.map((row) => record("caffeine", row, { brand: string(row.brand), product: string(row.product), caffeineMg: integer(row.caffeineMg), consumedAt: iso(row.consumedAt), timezone: string(row.timezone) }, dailyLogDate(row))),
  ...rows.alcohol.map((row) => record("alcohol", row, { alcoholType: string(row.alcoholType), servings: number(row.servings), consumedAt: iso(row.consumedAt), timezone: string(row.timezone) }, dailyLogDate(row))),
  ...rows.meal.map((row) => record("meal", row, { size: string(row.size), eatenAt: iso(row.eatenAt), notes: nullableString(row.notes), timezone: string(row.timezone) }, dailyLogDate(row))),
  ...rows.exercise.map((row) => record("exercise", row, { exerciseType: string(row.exerciseType), intensity: string(row.intensity), startedAt: iso(row.startedAt), endedAt: iso(row.endedAt), averageHeartRate: row.averageHeartRate === null || row.averageHeartRate === undefined ? null : integer(row.averageHeartRate), timezone: string(row.timezone) }, dailyLogDate(row))),
  ...rows.phoneUsage.map((row) => record("phone-usage", row, { lastUseAt: iso(row.lastUseAt), durationMinutes: integer(row.durationMinutes), timezone: string(row.timezone) }, row.localDate)),
  ...rows.wellness.map((row) => record("wellness", row, { fatigueLevel: integer(row.fatigueLevel), stressLevel: integer(row.stressLevel), timezone: string(row.timezone) }, row.localDate)),
];

const snapshotSchema = versionedPayloadSchema({ days: z.array(planDayTargetSchema) });
const narrationOutputEnvelopeSchema = versionedPayloadSchema(narrationOutputSchema.shape);

const mapAdvice = (row: Row): ScheduleAdviceEntity => {
  const input = parse(storedGeneratedAdviceInputSchema, {
    eventId: row.eventId ?? null,
    planId: row.planId ?? null,
    triggerType: row.triggerType,
    inputHash: row.inputHash,
    inputSnapshot: row.inputSnapshot,
    proposal: row.proposal,
  });
  const status = string(row.status);
  if (!["generated", "accepted", "dismissed", "superseded", "failed"].includes(status)) throw new CorruptStoredPayloadError();
  return { ...input, id: string(row.id), status: status as ScheduleAdviceEntity["status"] };
};

const mapPlans = (rows: readonly Row[]): readonly SleepPlanEntity[] => rows.map((row) => {
  const status = string(row.status);
  if (!["active", "superseded"].includes(status)) throw new CorruptStoredPayloadError();
  return { id: string(row.id), status: status as SleepPlanEntity["status"] };
});

const exportProfile = (row: Row): UserDataExport["profile"] => parse(profileSchema, {
  nickname: row.nickname,
  timezone: row.timezone,
  age: row.age,
  gender: row.gender,
  heightCm: row.heightCm,
  weightKg: row.weightKg,
});

export const createPrismaAccountDataRepository = (client: PrismaClient): AccountDataExportRepository => {
  return {
    load: async (scope) => {
      const where = { userId: scope.userId };
      const [user, profile, goal, habits, connection, sleep, caffeine, alcohol, meal, exercise, phoneUsage, wellness, revisions, events, plans, advice, planRevisions, analyses, narrations, completions, sessions] = await Promise.all([
        client.user.findFirst({ where: { id: scope.userId }, select: { email: true, createdAt: true } }),
        client.userProfile.findUnique({ where: { userId: scope.userId }, select: { nickname: true, timezone: true, age: true, gender: true, heightCm: true, weightKg: true } }),
        client.sleepGoal.findUnique({ where: { userId: scope.userId }, select: { targetBedTime: true, targetWakeTime: true, targetDurationMinutes: true } }),
        client.userHabit.findUnique({ where: { userId: scope.userId }, select: { caffeine: true, exercise: true, meal: true, alcohol: true, phoneUsage: true } }),
        client.connection.findUnique({ where: { userId: scope.userId }, select: { selected: true, mode: true, availability: true, state: true } }),
        client.sleepSession.findMany({ where, orderBy: { createdAt: "asc" } }),
        client.caffeineEntry.findMany({ where, include: { dailyLog: { select: { localDate: true } } }, orderBy: { createdAt: "asc" } }),
        client.alcoholEntry.findMany({ where, include: { dailyLog: { select: { localDate: true } } }, orderBy: { createdAt: "asc" } }),
        client.mealEntry.findMany({ where, include: { dailyLog: { select: { localDate: true } } }, orderBy: { createdAt: "asc" } }),
        client.exerciseEntry.findMany({ where, include: { dailyLog: { select: { localDate: true } } }, orderBy: { createdAt: "asc" } }),
        client.phoneUsageEntry.findMany({ where, orderBy: { createdAt: "asc" } }),
        client.wellnessEntry.findMany({ where, orderBy: { createdAt: "asc" } }),
        client.recordRevision.findMany({ where, orderBy: { changedAt: "asc" } }),
        client.specialEvent.findMany({ where, orderBy: { startsAt: "asc" }, select: { id: true, type: true, startsAt: true, desiredWakeAt: true } }),
        client.sleepPlan.findMany({ where, orderBy: { createdAt: "asc" }, select: { id: true, status: true } }),
        client.scheduleAdvice.findMany({ where, orderBy: { generatedAt: "asc" } }),
        client.planRevision.findMany({ where, orderBy: { createdAt: "asc" }, select: { id: true, planId: true, beforeSnapshot: true, afterSnapshot: true, createdAt: true } }),
        client.analysisSnapshot.findMany({ where, orderBy: { generatedAt: "asc" }, select: { localDate: true, result: true } }),
        client.narration.findMany({ where, orderBy: { generatedAt: "asc" }, select: { analysisSnapshotId: true, scheduleAdviceId: true, status: true, output: true } }),
        client.routineCompletion.findMany({ where, orderBy: { completedAt: "asc" }, select: { localDate: true, stepKey: true, completedAt: true } }),
        client.careToolSession.findMany({ where, orderBy: { startedAt: "asc" }, select: { localDate: true, toolKey: true, startedAt: true, plannedDurationSeconds: true, completedAt: true } }),
      ]);

      if (!user || !profile || !goal) throw new CorruptStoredPayloadError();
      const userRow = asRow(user);
      const profileRow = asRow(profile);
      const goalRow = asRow(goal);
      const habitRow = habits ? asRow(habits) : null;
      const connectionRow = connection ? asRow(connection) : null;
      const connectionState = connectionRow ? string(connectionRow.state) : "needs-input";
      if (!["complete", "needs-input", "unavailable"].includes(connectionState)) throw new CorruptStoredPayloadError();

      return {
        identity: { email: string(userRow.email), createdAt: iso(userRow.createdAt) },
        profile: exportProfile(profileRow),
        sleepGoal: { targetBedTime: string(goalRow.targetBedTime), targetWakeTime: string(goalRow.targetWakeTime), targetDurationMinutes: integer(goalRow.targetDurationMinutes) },
        habits: habitRow ? ["caffeine", "exercise", "meal", "alcohol", "phoneUsage"].map((category) => ({
          category,
          value: category === "alcohol" ? nullableString(habitRow[category]) : string(habitRow[category]),
        })) : [],
        connections: [{ type: "manual", label: "직접 입력", mode: connectionRow?.mode === "automatic" ? "automatic" : "manual", availability: connectionRow?.availability === "coming-soon" ? "coming-soon" : "available", state: connectionState as "complete" | "needs-input" | "unavailable", lastSyncedAt: null }],
        records: mapRecords({ sleep: sleep.map(asRow), caffeine: caffeine.map(asRow), alcohol: alcohol.map(asRow), meal: meal.map(asRow), exercise: exercise.map(asRow), phoneUsage: phoneUsage.map(asRow), wellness: wellness.map(asRow) }),
        recordRevisions: revisions.map((value) => {
          const row = asRow(value);
          const operation = string(row.operation);
          const entityType = string(row.entityType);
          if (!["create", "update", "delete"].includes(operation) || !["sleep", "caffeine", "alcohol", "meal", "exercise", "phone-usage", "wellness"].includes(entityType)) throw new CorruptStoredPayloadError();
          return { entityType: entityType as UserDataExport["recordRevisions"][number]["entityType"], entityId: string(row.entityId), operation: operation as "create" | "update" | "delete", before: row.before === null ? null : parse(recordRevisionEnvelopeSchema, row.before), after: row.after === null ? null : parse(recordRevisionEnvelopeSchema, row.after), changedAt: iso(row.changedAt) };
        }),
        planner: {
          events: events.map((value) => { const row = asRow(value); return { id: string(row.id), type: string(row.type), startsAt: iso(row.startsAt), desiredWakeAt: row.desiredWakeAt === null || row.desiredWakeAt === undefined ? null : iso(row.desiredWakeAt) }; }),
          plans: mapPlans(plans.map(asRow)),
          advice: advice.map((value) => mapAdvice(asRow(value))),
          revisions: planRevisions.map((value) => { const row = asRow(value); return { id: string(row.id), planId: string(row.planId), before: parse(snapshotSchema, row.beforeSnapshot), after: parse(snapshotSchema, row.afterSnapshot), createdAt: iso(row.createdAt) }; }),
        },
        analyses: analyses.map((value) => { const row = asRow(value); return { localDate: localDate(row.localDate), result: parse(analysisResultSchemaEnvelope, row.result).analysisResult }; }),
        narrations: narrations.flatMap((value) => {
          const row = asRow(value);
          const status = string(row.status);
          if (status === "pending") return [];
          if (status !== "ready" && status !== "template-fallback") throw new CorruptStoredPayloadError();
          const targetId = row.analysisSnapshotId ?? row.scheduleAdviceId;
          if (typeof targetId !== "string" || !targetId || (row.analysisSnapshotId && row.scheduleAdviceId) || row.output === null || row.output === undefined) throw new CorruptStoredPayloadError();
          return [{ targetId, status, output: parse(narrationOutputEnvelopeSchema, row.output) }];
        }),
        care: {
          routineCompletions: completions.map((value) => { const row = asRow(value); return { localDate: localDate(row.localDate), stepKey: string(row.stepKey), completedAt: iso(row.completedAt) }; }),
          toolSessions: sessions.map((value) => { const row = asRow(value); const toolKey = string(row.toolKey); if (!["breathing", "white-noise", "sleep-guide"].includes(toolKey)) throw new CorruptStoredPayloadError(); return { localDate: localDate(row.localDate), toolKey: toolKey as "breathing" | "white-noise" | "sleep-guide", startedAt: iso(row.startedAt), plannedDurationSeconds: integer(row.plannedDurationSeconds), completedAt: row.completedAt === null || row.completedAt === undefined ? null : iso(row.completedAt) }; }),
        },
      };
    },
  };
};
