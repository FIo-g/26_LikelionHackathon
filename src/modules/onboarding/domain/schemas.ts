import { z } from "zod";

import {
  type ConnectInput,
  type HabitValues,
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

export const connectSchema = z.object({
  selected: z.literal("manual"),
}).strict();

const sleepGoalInputSchema = z.object({
  targetBedTime: clockTime,
  targetWakeTime: clockTime,
}).strict().refine((value) => value.targetBedTime !== value.targetWakeTime, {
  code: "custom",
  path: ["targetWakeTime"],
  message: "targetBedTime and targetWakeTime must differ",
});

export const sleepGoalSchema = sleepGoalInputSchema
  .transform((value) => ({
    ...value,
    targetDurationMinutes: calculateSleepDurationMinutes(value),
  }))
  .refine((value) => value.targetDurationMinutes >= 120 && value.targetDurationMinutes <= 960, {
    code: "custom",
    path: ["targetDurationMinutes"],
    message: "targetDurationMinutes must be 120-960",
  });

export const habitsSchema = z.object({
  caffeine: z.enum(["none", "sometimes", "daily"]),
  exercise: z.enum(["rare", "weekly", "frequent"]),
  meal: z.enum(["early", "mixed", "late"]),
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
}).strict();

export const parseConnectSchema = (value: unknown): ConnectInput => connectSchema.parse(value);
export const parseSleepGoalSchema = (value: SleepGoalFormInput): SleepGoalInput => sleepGoalSchema.parse(value);
export const parseHabitsSchema = (value: unknown): HabitValues => habitsSchema.parse(value);
export const parseProfileSchema = (value: unknown): ProfileInput => profileSchema.parse(value);

