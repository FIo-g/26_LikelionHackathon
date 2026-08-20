import { z } from "zod";

import { versionedPayloadSchema } from "@/shared/validation/versioned-json";
import type {
  AcceptedAdviceInput,
  GeneratedAdviceInput,
  PlanDayTarget,
  PlannerInputSnapshot,
  ScheduleProposal,
  SpecialEventInput,
} from "./types";

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instantSchema = z.string().datetime({ offset: true });
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timezoneSchema = z.string().min(1).refine((value) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");

const evidenceSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  direction: z.enum(["positive", "negative", "neutral"]),
  value: z.union([z.string(), z.number().finite(), z.null()]),
  count: z.number().int().min(0).nullable(),
}).strict();

export const planDayTargetSchema = z.object({
  localDate: localDateSchema,
  targetBedAt: instantSchema,
  targetWakeAt: instantSchema,
  caffeineCutoffAt: instantSchema,
  exerciseCutoffAt: instantSchema,
  mealCutoffAt: instantSchema,
  windDownAt: instantSchema,
}).strict() as z.ZodType<PlanDayTarget>;

export const scheduleProposalSchema = z.object({
  adjustmentStartsOn: localDateSchema,
  eventWakeAt: instantSchema,
  days: z.array(planDayTargetSchema).min(1),
  conflicts: z.array(z.string().min(1)),
  confidence: z.enum(["low", "medium", "high"]),
  evidence: z.array(evidenceSchema),
  algorithmVersion: z.literal("provisional-v1"),
}).strict() as z.ZodType<ScheduleProposal>;

export const specialEventInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(80),
  startsAt: instantSchema,
  desiredWakeAt: instantSchema.nullable(),
  notes: z.string().max(4_000).nullable(),
  timezone: timezoneSchema,
}).strict() as z.ZodType<SpecialEventInput>;

const inputSnapshotSchema = versionedPayloadSchema({
  timezone: timezoneSchema,
  goal: z.object({
    targetBedTime: timeSchema,
    targetWakeTime: timeSchema,
    targetDurationMinutes: z.number().int().min(120).max(960),
  }).strict(),
  baselineId: z.string().min(1).nullable(),
  event: z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    startsAt: instantSchema,
    desiredWakeAt: instantSchema.nullable(),
  }).strict().nullable(),
  planId: z.string().min(1).nullable(),
  triggerRecordId: z.string().min(1).nullable(),
  rerouteRecords: z.array(z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    input: z.record(z.string(), z.union([z.string(), z.number().finite(), z.null()])),
  }).strict()).optional(),
}).superRefine((value, context) => {
  const hasEvent = value.event !== null;
  const hasPlan = value.planId !== null;
  if (hasEvent === hasPlan) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Snapshot must target exactly one event or plan" });
  }
}) as z.ZodType<PlannerInputSnapshot>;

export const generatedAdviceInputSchema = z.object({
  eventId: z.string().min(1).nullable(),
  planId: z.string().min(1).nullable(),
  triggerType: z.enum(["event", "reroute"]),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  inputSnapshot: inputSnapshotSchema,
  proposal: scheduleProposalSchema,
}).strict().superRefine((value, context) => {
  const isEvent = value.triggerType === "event";
  const targetMatches = isEvent
    ? value.eventId !== null
      && value.planId === null
      && value.inputSnapshot.event?.id === value.eventId
      && value.inputSnapshot.planId === null
      && value.inputSnapshot.triggerRecordId === null
    : value.eventId === null
      && value.planId !== null
      && value.inputSnapshot.event === null
      && value.inputSnapshot.planId === value.planId
      && value.inputSnapshot.triggerRecordId !== null
      && value.inputSnapshot.rerouteRecords !== undefined
      && value.inputSnapshot.rerouteRecords.length > 0;

  if (!targetMatches) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Advice trigger and immutable target must agree" });
  }
}) as z.ZodType<GeneratedAdviceInput>;

export const acceptedAdviceInputSchema = z.object({
  adviceId: z.string().min(1),
  before: versionedPayloadSchema({ days: z.array(planDayTargetSchema) }),
  after: versionedPayloadSchema({ days: z.array(planDayTargetSchema).min(1) }),
}).strict() as z.ZodType<AcceptedAdviceInput>;
