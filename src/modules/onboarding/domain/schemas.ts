import { z } from "zod";

import {
  HABIT_ALCOHOL_FREQUENCIES,
  PROFILE_GENDERS,
  type ConnectInput,
  type HabitValues,
  type ProfileDetails,
  type SleepGoalInput,
  type SleepGoalFormInput,
  type ProfileInput,
} from "./types";
import { calculateSleepDurationMinutes } from "./calculate-sleep-duration";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const getSupportedTimezones = (): ReadonlySet<string> => {
  try {
    return new Set(Intl.supportedValuesOf("timeZone"));
  } catch {
    return new Set(["Asia/Seoul", "America/New_York", "Europe/London", "UTC"]);
  }
};

const isSupportedTimezone = (value: string): boolean => {
  const normalized = value.trim();
  const supported = getSupportedTimezones();
  if (supported.has(normalized)) {
    return true;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: normalized });
    return true;
  } catch {
    return false;
  }
};

const clockTime = z.string().regex(timeRegex, "Invalid HH:mm format");

const nullForBlankOrMissing = (value: unknown): unknown => (
  value === "" || value === undefined || value === null ? null : value
);

const nullForBlank = (value: unknown): unknown => (
  value === "" || value === null ? null : value
);

const nullableInteger = (minimum: number, maximum: number) => z.preprocess(
  nullForBlankOrMissing,
  z.union([z.null(), z.coerce.number().int().min(minimum).max(maximum)]),
);

const optionalNullableInteger = (minimum: number, maximum: number) => z.preprocess(
  nullForBlank,
  z.union([z.null(), z.coerce.number().int().min(minimum).max(maximum)]).optional(),
);

const nullableWeight = z.preprocess(
  nullForBlankOrMissing,
  z.union([
    z.null(),
    z.coerce.number().min(20).max(500).refine((value) => Number.isInteger(value * 10), {
      message: "weightKg must have at most one decimal place",
    }),
  ]),
);

const optionalNullableWeight = z.preprocess(
  nullForBlank,
  z.union([
    z.null(),
    z.coerce.number().min(20).max(500).refine((value) => Number.isInteger(value * 10), {
      message: "weightKg must have at most one decimal place",
    }),
  ]).optional(),
);

const nullableGender = z.preprocess(
  nullForBlankOrMissing,
  z.union([z.null(), z.enum(PROFILE_GENDERS)]),
);

const optionalNullableGender = z.preprocess(
  nullForBlank,
  z.union([z.null(), z.enum(PROFILE_GENDERS)]).optional(),
);

export const connectSchema = z.object({
  selected: z.literal("manual"),
}).strict();

const sleepGoalInputSchema = z.object({
  targetBedTime: clockTime,
  targetWakeTime: clockTime,
}).strict().refine((value) => value.targetBedTime !== value.targetWakeTime, {
  path: ["targetWakeTime"],
  message: "targetBedTime and targetWakeTime must differ",
});

export const sleepGoalSchema = sleepGoalInputSchema
  .transform((value) => ({
    ...value,
    targetDurationMinutes: calculateSleepDurationMinutes(value),
  }))
  .refine((value) => value.targetDurationMinutes >= 120 && value.targetDurationMinutes <= 960, {
    path: ["targetDurationMinutes"],
    message: "targetDurationMinutes must be 120-960",
  });

export const habitsSchema = z.object({
  caffeine: z.enum(["none", "sometimes", "daily"]),
  exercise: z.enum(["rare", "weekly", "frequent"]),
  meal: z.enum(["early", "mixed", "late"]),
  alcohol: z.preprocess(
    nullForBlankOrMissing,
    z.union([z.null(), z.enum(HABIT_ALCOHOL_FREQUENCIES)]),
  ),
  phoneUsage: z.enum(["low", "medium", "high"]),
}).strict();

export const profileSchema = z.object({
  nickname: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(40)),
  timezone: z.string().trim().min(1).superRefine((value, context) => {
    if (!isSupportedTimezone(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid timezone",
        path: ["timezone"],
      });
    }
  }),
  age: nullableInteger(1, 120),
  gender: nullableGender,
  heightCm: nullableInteger(50, 300),
  weightKg: nullableWeight,
}).strict();

/**
 * Account settings supports partial updates. Absent expanded fields must not
 * erase values saved through onboarding; an explicit blank field becomes null.
 */
export const profileUpdateSchema = z.object({
  nickname: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(40)),
  timezone: z.string().trim().min(1).superRefine((value, context) => {
    if (!isSupportedTimezone(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid timezone",
        path: ["timezone"],
      });
    }
  }),
  age: optionalNullableInteger(1, 120),
  gender: optionalNullableGender,
  heightCm: optionalNullableInteger(50, 300),
  weightKg: optionalNullableWeight,
}).strict();

export const parseConnectSchema = (value: unknown): ConnectInput => connectSchema.parse(value);
export const parseSleepGoalSchema = (value: SleepGoalFormInput): SleepGoalInput => sleepGoalSchema.parse(value);
export const parseHabitsSchema = (value: unknown): HabitValues => habitsSchema.parse(value);
export const parseProfileSchema = (value: unknown): ProfileDetails => profileSchema.parse(value);
export const parseProfileUpdateSchema = (value: unknown): ProfileInput => profileUpdateSchema.parse(value);
