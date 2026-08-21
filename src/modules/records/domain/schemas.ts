import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";

import type { Clock } from "@/shared/domain/contracts";
import {
  alcoholMeasurementUnits,
  type CreateRecordInput,
  type RecordType,
  type UpdateRecordInput,
} from "./types";

const MAX_SESSION_MINUTES = 1_440;
const MIN_SESSION_MINUTES = 0;
const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTE_TOLERANCE_MS = 5 * 60 * 1000;

const SUPPORTED_TIMEZONES = (() => {
  try {
    return new Set(Intl.supportedValuesOf("timeZone"));
  } catch {
    return new Set(["Asia/Seoul", "America/New_York", "Europe/London", "UTC"]);
  }
})();

const isSupportedTimezone = (value: string): boolean => {
  const normalized = value.trim();

  if (SUPPORTED_TIMEZONES.has(normalized)) {
    return true;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: normalized });
    return true;
  } catch {
    return false;
  }
};

const timezoneSchema = z.string().superRefine((value, context) => {
  if (!isSupportedTimezone(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid timezone",
      path: ["timezone"],
    });
  }
});

const parseDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return parsed;
  }

  return value as Date;
};

const dateSchema = z.preprocess(parseDate, z.date());

const isDateAfterClock = (value: Date, clock: Clock): boolean => (
  value.getTime() > (clock.now().getTime() + FIVE_MINUTE_TOLERANCE_MS)
);

const checkFutureDate = (clock: Clock, value: Date, path: PropertyKey[], context: z.RefinementCtx) => {
  if (isDateAfterClock(value, clock)) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      path,
      maximum: clock.now().getTime() + FIVE_MINUTE_TOLERANCE_MS,
      inclusive: true,
      origin: "date",
      message: "Date must not be more than 5 minutes in the future",
    });
  }
};

const durationSchema = (clock: Clock) => z.object({
  type: z.literal("sleep"),
  startedAt: dateSchema,
  endedAt: dateSchema,
  morningFatigue: z.number().int().min(1).max(5),
  timezone: timezoneSchema,
}).strict().superRefine((value, context) => {
  checkFutureDate(clock, value.startedAt, ["startedAt"], context);
  checkFutureDate(clock, value.endedAt, ["endedAt"], context);

  const durationMinutes = (value.endedAt.getTime() - value.startedAt.getTime()) / ONE_MINUTE_MS;
  if (durationMinutes < 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endedAt"],
      message: "endedAt must be after startedAt",
    });
  }

  if (durationMinutes > MAX_SESSION_MINUTES) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      path: ["endedAt"],
      maximum: MAX_SESSION_MINUTES,
      inclusive: true,
      origin: "number",
      message: "Duration must not exceed 1440 minutes",
    });
  }

});

const caffeineSchema = (clock: Clock) => z.object({
  type: z.literal("caffeine"),
  brand: z.string().trim().min(1).max(80),
  product: z.string().trim().min(1).max(80),
  caffeineMg: z.number().min(0).max(1000),
  consumedAt: dateSchema,
  timezone: timezoneSchema,
}).strict().superRefine((value, context) => {
  checkFutureDate(clock, value.consumedAt, ["consumedAt"], context);
});

const alcoholSchema = (clock: Clock) => z.object({
  type: z.literal("alcohol"),
  alcoholType: z.string().trim().min(1).max(80),
  servings: z.number().min(0.25).max(20),
  measurementUnit: z.enum(alcoholMeasurementUnits),
  consumedAt: dateSchema,
  timezone: timezoneSchema,
}).strict().superRefine((value, context) => {
  checkFutureDate(clock, value.consumedAt, ["consumedAt"], context);
});

const mealSchema = (clock: Clock) => z.object({
  type: z.literal("meal"),
  size: z.enum(["small", "medium", "large"]),
  eatenAt: dateSchema,
  notes: z.string().max(500).nullable(),
  timezone: timezoneSchema,
}).strict().superRefine((value, context) => {
  checkFutureDate(clock, value.eatenAt, ["eatenAt"], context);
});

const exerciseSchema = (clock: Clock) => z.object({
  type: z.literal("exercise"),
  exerciseType: z.string().trim().min(1).max(80),
  intensity: z.enum(["low", "medium", "high"]),
  startedAt: dateSchema,
  endedAt: dateSchema,
  averageHeartRate: z.number().int().nullable().refine((value) => (
    value === null || (value >= 30 && value <= 240)
  ), {
    message: "averageHeartRate must be null or 30-240",
    path: ["averageHeartRate"],
  }),
  timezone: timezoneSchema,
}).strict().superRefine((value, context) => {
  checkFutureDate(clock, value.startedAt, ["startedAt"], context);
  checkFutureDate(clock, value.endedAt, ["endedAt"], context);

  const durationMinutes = (value.endedAt.getTime() - value.startedAt.getTime()) / ONE_MINUTE_MS;
  if (durationMinutes < 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endedAt"],
      message: "endedAt must be after startedAt",
    });
  }

  if (durationMinutes > MAX_SESSION_MINUTES) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      path: ["endedAt"],
      maximum: MAX_SESSION_MINUTES,
      inclusive: true,
      origin: "number",
      message: "Duration must not exceed 1440 minutes",
    });
  }
});

const phoneUsageSchema = (clock: Clock) => z.object({
  type: z.literal("phone-usage"),
  lastUseAt: dateSchema,
  durationMinutes: z.number().min(MIN_SESSION_MINUTES).max(MAX_SESSION_MINUTES),
  timezone: timezoneSchema,
}).strict().superRefine((value, context) => {
  checkFutureDate(clock, value.lastUseAt, ["lastUseAt"], context);
});

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}, "INVALID_LOCAL_DATE");
const wellnessSchema = () => z.object({
  type: z.literal("wellness"),
  localDate: localDateSchema,
  fatigueLevel: z.number().int().min(1).max(5),
  stressLevel: z.number().int().min(1).max(5),
  timezone: timezoneSchema,
}).strict();

export const createRecordInputSchema = (clock: Clock) => (
  z.discriminatedUnion("type", [
    durationSchema(clock),
    caffeineSchema(clock),
    alcoholSchema(clock),
    mealSchema(clock),
    exerciseSchema(clock),
    phoneUsageSchema(clock),
    wellnessSchema(),
  ]) as z.ZodType<CreateRecordInput>
);

export const updateRecordInputSchema = (clock: Clock) => (
  createRecordInputSchema(clock) as z.ZodType<UpdateRecordInput>
);

export const parseCreateRecordInput = (clock: Clock, input: unknown): CreateRecordInput => (
  createRecordInputSchema(clock).parse(input)
);

export const parseUpdateRecordInput = (clock: Clock, input: unknown): UpdateRecordInput => (
  updateRecordInputSchema(clock).parse(input)
);

export const buildRecordTypeSchema = () => z.enum([
  "sleep",
  "caffeine",
  "alcohol",
  "meal",
  "exercise",
  "phone-usage",
  "wellness",
] as const) as z.ZodType<RecordType>;
