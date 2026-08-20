import { Temporal } from "@js-temporal/polyfill";

import type { BaselineResult, NormalizedAnalysisInput, NormalizedDailyRecords, SleepGoal } from "./types";
import { estimateConfidenceLevelFromScore, clampToRange } from "./calculate-confidence";

const MIN_VALID_SLEEP_MINUTES = 120;
const MAX_VALID_SLEEP_MINUTES = 960;
const REQUIRED_SLEEP_DAYS = 3;

const clampToMinute = (value: number): number => Math.round(((value % 1440) + 1440) % 1440);

const isValidLocalDate = (value: string): value is string => {
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
};

const parseTargetMinute = (time: string): number | null => {
  const [, hour, minute] = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time) ?? [];
  if (!hour || !minute) {
    return null;
  }

  return Number(hour) * 60 + Number(minute);
};

const isValidMinute = (value: number | null): value is number => (
  value !== null && Number.isFinite(value) && value >= 0 && value < 1440 && Number.isInteger(value)
);

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return (left + right) / 2;
};

const radiansPerMinute = (Math.PI * 2) / 1440;

const circularMean = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  for (const value of values) {
    const radians = value * radiansPerMinute;
    sumX += Math.cos(radians);
    sumY += Math.sin(radians);
  }

  const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
  if (magnitude < 1e-6) {
    return null;
  }

  const angle = Math.atan2(sumY, sumX);
  const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
  const minute = Math.round(normalizedAngle / radiansPerMinute) % 1440;
  return Math.abs(minute);
};

const nearestToTarget = (values: readonly number[], targetMinute: number): number => {
  let selected = values[0] ?? targetMinute;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const minute of values) {
    const distance = Math.abs(((minute - targetMinute + 720) % 1440) - 720);
    if (distance < bestDistance) {
      selected = minute;
      bestDistance = distance;
    }
  }

  return selected;
};

const deriveTargetGoal = (goal: Partial<SleepGoal>): SleepGoal => {
  const duration = goal.targetDurationMinutes;
  return {
    targetBedTime: goal.targetBedTime ?? "22:00",
    targetWakeTime: goal.targetWakeTime ?? "07:00",
    targetDurationMinutes: duration !== undefined && Number.isFinite(duration) && duration > 0
      ? duration
      : 480,
  };
};

const isDailyRecordsArray = (
  input: Readonly<NormalizedAnalysisInput> | readonly NormalizedDailyRecords[],
): input is readonly NormalizedDailyRecords[] => Array.isArray(input);

const normalizeInput = (
  input: Readonly<NormalizedAnalysisInput> | readonly NormalizedDailyRecords[],
): {
  days: readonly NormalizedDailyRecords[];
  goal: SleepGoal;
} => {
  if (isDailyRecordsArray(input)) {
    return {
      days: input,
      goal: deriveTargetGoal({
        targetBedTime: "22:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      }),
    };
  }

  return {
    days: input.days,
    goal: input.goal,
  };
};

export const calculateBaseline = (input: Readonly<NormalizedAnalysisInput> | readonly NormalizedDailyRecords[]): BaselineResult => {
  const normalized = normalizeInput(input);
  const days = normalized.days;
  const inputGoal = deriveTargetGoal(normalized.goal);

  const seenLocalDate = new Set<string>();
  let excludedCount = 0;
  let sampleCount = 0;

  const validSleepMinutes: number[] = [];
  const bedMinutes: number[] = [];
  const wakeMinutes: number[] = [];

  for (const day of days) {
    if (!isValidLocalDate(day.localDate)) {
      excludedCount += 1;
      continue;
    }

    if (seenLocalDate.has(day.localDate)) {
      excludedCount += 1;
      continue;
    }

    const bedMinute = day.bedMinuteOfDay;
    const wakeMinute = day.wakeMinuteOfDay;
    const sleepMinutes = day.sleepMinutes;

    if (!isValidMinute(bedMinute) || !isValidMinute(wakeMinute) || sleepMinutes === null || !Number.isFinite(sleepMinutes)) {
      excludedCount += 1;
      continue;
    }

    if (sleepMinutes < MIN_VALID_SLEEP_MINUTES || sleepMinutes > MAX_VALID_SLEEP_MINUTES) {
      excludedCount += 1;
      continue;
    }

    seenLocalDate.add(day.localDate);
    sampleCount += 1;
    validSleepMinutes.push(sleepMinutes);
    bedMinutes.push(bedMinute);
    wakeMinutes.push(wakeMinute);
  }

  const baselineSleepMinutes = median(validSleepMinutes);
  const goalBed = parseTargetMinute(inputGoal.targetBedTime) ?? 1320;
  const goalWake = parseTargetMinute(inputGoal.targetWakeTime) ?? 420;

  let baselineBedMinuteOfDay = circularMean(bedMinutes);
  let baselineWakeMinuteOfDay = circularMean(wakeMinutes);

  if (baselineBedMinuteOfDay === null && bedMinutes.length > 0) {
    baselineBedMinuteOfDay = nearestToTarget(bedMinutes, goalBed);
  }

  if (baselineWakeMinuteOfDay === null && wakeMinutes.length > 0) {
    baselineWakeMinuteOfDay = nearestToTarget(wakeMinutes, goalWake);
  }

  baselineBedMinuteOfDay = baselineBedMinuteOfDay === null ? null : clampToMinute(baselineBedMinuteOfDay);
  baselineWakeMinuteOfDay = baselineWakeMinuteOfDay === null ? null : clampToMinute(baselineWakeMinuteOfDay);

  const confidence = sampleCount < REQUIRED_SLEEP_DAYS
    ? "insufficient"
    : estimateConfidenceLevelFromScore(clampToRange(sampleCount / REQUIRED_SLEEP_DAYS, 0, 1), false);

  return {
    baselineSleepMinutes,
    baselineBedMinuteOfDay,
    baselineWakeMinuteOfDay,
    sampleCount,
    excludedCount,
    confidence,
  };
};
