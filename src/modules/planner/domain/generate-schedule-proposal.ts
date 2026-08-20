import { Temporal } from "@js-temporal/polyfill";

import { baselineResultSchemaEnvelope } from "@/modules/analysis/domain/schemas";
import type { BaselineResult } from "@/modules/analysis/domain/types";
import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import type { Evidence } from "@/shared/domain/contracts";
import { PROVISIONAL_PLANNER_RULES } from "./provisional-v1-config";
import type { PlannerBaselineSnapshot, PlannerConfidence, PlanDayTarget, ScheduleContext, ScheduleProposal } from "./types";

export type { ScheduleContext } from "./types";

type ResolvedWallTime = Readonly<{
  value: Temporal.ZonedDateTime;
  dstAdjusted: boolean;
}>;

const parseMinuteOfDay = (value: string): number => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error("INVALID_PLANNER_TIME");
  }

  return Number(match[1]) * 60 + Number(match[2]);
};

const localDate = (value: Temporal.ZonedDateTime): string => (
  `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`
);

const resolveWallTime = (
  date: Temporal.PlainDate,
  minuteOfDay: number,
  timezone: string,
): ResolvedWallTime => {
  const normalizedMinute = ((minuteOfDay % 1440) + 1440) % 1440;
  const hour = Math.floor(normalizedMinute / 60);
  const minute = normalizedMinute % 60;
  const value = Temporal.ZonedDateTime.from({
    timeZone: timezone,
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    minute,
  }, { disambiguation: "compatible" });

  return {
    value,
    dstAdjusted: value.year !== date.year
      || value.month !== date.month
      || value.day !== date.day
      || value.hour !== hour
      || value.minute !== minute,
  };
};

const toInstantString = (value: Temporal.ZonedDateTime): string => value.toInstant().toString();

const unwrapBaselineResult = (baseline: PlannerBaselineSnapshot | null): BaselineResult | null => {
  if (!baseline || baseline.status !== "current") {
    return null;
  }

  const parsed = baselineResultSchemaEnvelope.safeParse(baseline.result);
  return parsed.success ? parsed.data.baseline : null;
};

const baselineWakeMinute = (baseline: PlannerBaselineSnapshot | null): number | null => {
  const result = unwrapBaselineResult(baseline);
  if (!result) {
    return null;
  }

  const minute = result.baselineWakeMinuteOfDay;
  const samples = result.sampleCount;
  return typeof minute === "number" && Number.isInteger(minute) && minute >= 0 && minute < 1440
    && typeof samples === "number" && samples >= 3
    ? minute
    : null;
};

const baselineConfidence = (baseline: PlannerBaselineSnapshot | null): PlannerConfidence | null => {
  const result = unwrapBaselineResult(baseline);
  if (!result) {
    return null;
  }

  const value = result.confidence;
  return value === "medium" || value === "high" ? value : null;
};

const evidence = (
  baselineMinute: number | null,
  adjustedForDst: boolean,
): Evidence[] => {
  const result: Evidence[] = [];
  if (baselineMinute === null) {
    result.push({
      code: "insufficient-history",
      label: "최근 수면 기록이 부족해 목표 수면 시간으로 계획을 만들었습니다.",
      direction: "neutral",
      value: null,
      count: null,
    });
  }
  if (adjustedForDst) {
    result.push({
      code: "dst-adjusted",
      label: "일광 절약 시간 전환에 맞춰 반복 목표 시간을 조정했습니다.",
      direction: "neutral",
      value: null,
      count: null,
    });
  }
  return result;
};

const buildDay = (
  date: Temporal.PlainDate,
  wakeMinute: number,
  timezone: string,
  durationMinutes: number,
): Readonly<{ day: PlanDayTarget; dstAdjusted: boolean }> => {
  const wake = resolveWallTime(date, wakeMinute, timezone);
  const bed = wake.value.subtract({ minutes: durationMinutes });
  const caffeine = bed.subtract({ minutes: PROVISIONAL_PLANNER_RULES.caffeineCutoffMinutesBeforeBed });
  const exercise = bed.subtract({ minutes: PROVISIONAL_PLANNER_RULES.exerciseCutoffMinutesBeforeBed });
  const meal = bed.subtract({ minutes: PROVISIONAL_PLANNER_RULES.mealCutoffMinutesBeforeBed });
  const windDown = bed.subtract({ minutes: PROVISIONAL_PLANNER_RULES.windDownMinutesBeforeBed });

  return {
    day: {
      localDate: localDate(wake.value),
      targetBedAt: toInstantString(bed),
      targetWakeAt: toInstantString(wake.value),
      caffeineCutoffAt: toInstantString(caffeine),
      exerciseCutoffAt: toInstantString(exercise),
      mealCutoffAt: toInstantString(meal),
      windDownAt: toInstantString(windDown),
    },
    dstAdjusted: wake.dstAdjusted,
  };
};

export const createPlannerInputHash = (inputSnapshot: unknown): string => hashCanonicalJson(inputSnapshot);

export const generateGoalPlanTargets = (
  goal: ScheduleContext["goal"],
  timezone: string,
  now: Date,
  numberOfDays = 14,
): readonly PlanDayTarget[] => {
  const startDate = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timezone).toPlainDate();
  const wakeMinute = parseMinuteOfDay(goal.targetWakeTime);

  return Array.from({ length: numberOfDays }, (_, index) => (
    buildDay(startDate.add({ days: index }), wakeMinute, timezone, goal.targetDurationMinutes).day
  ));
};

export const generateScheduleProposal = (context: ScheduleContext): ScheduleProposal => {
  const eventStart = Temporal.Instant.from(context.event.startsAt).toZonedDateTimeISO(context.timezone);
  const eventDate = eventStart.toPlainDate();
  const goalWakeMinute = parseMinuteOfDay(context.goal.targetWakeTime);
  const startingWakeMinute = goalWakeMinute;
  const normalGoalWake = resolveWallTime(eventDate, goalWakeMinute, context.timezone);
  const eventWake = context.event.desiredWakeAt
    ? Temporal.Instant.from(context.event.desiredWakeAt)
    : Temporal.Instant.compare(
      normalGoalWake.value.toInstant(),
      eventStart.subtract({ hours: 2 }).toInstant(),
    ) <= 0
      ? normalGoalWake.value.toInstant()
      : eventStart.subtract({ hours: 2 }).toInstant();
  const startingWake = normalGoalWake.value;
  const adjustmentMinutes = Math.round(eventWake.since(startingWake.toInstant()).total({ unit: "minutes" }));
  const requiredDays = Math.ceil(Math.abs(adjustmentMinutes) / PROVISIONAL_PLANNER_RULES.maximumDailyMovementMinutes);
  const adjustmentDays = Math.min(requiredDays, PROVISIONAL_PLANNER_RULES.maximumAdjustmentDays);
  const adjustmentStartsOn = eventDate.subtract({ days: adjustmentDays });
  const direction = Math.sign(adjustmentMinutes);
  const days: PlanDayTarget[] = [];
  let dstAdjusted = normalGoalWake.dstAdjusted;

  for (let index = 0; index <= adjustmentDays; index += 1) {
    const date = adjustmentStartsOn.add({ days: index });
    const movement = Math.min(Math.abs(adjustmentMinutes), index * PROVISIONAL_PLANNER_RULES.maximumDailyMovementMinutes);
    const built = buildDay(
      date,
      startingWakeMinute + direction * movement,
      context.timezone,
      context.goal.targetDurationMinutes,
    );
    days.push(built.day);
    dstAdjusted ||= built.dstAdjusted;
  }

  const conflicts = requiredDays > PROVISIONAL_PLANNER_RULES.maximumAdjustmentDays
    ? ["unreachable-with-daily-limit"]
    : [];
  const baselineMinute = baselineWakeMinute(context.baseline);

  return {
    adjustmentStartsOn: adjustmentStartsOn.toString(),
    eventWakeAt: eventWake.toString(),
    days,
    conflicts,
    confidence: baselineMinute === null ? "low" : baselineConfidence(context.baseline) ?? "low",
    evidence: evidence(baselineMinute, dstAdjusted),
    algorithmVersion: "provisional-v1",
  };
};
