import type { ConfidenceLevel } from "@/shared/domain/contracts";
import type { BaselineResult, ConfidenceResult, DirectCategory, NormalizedDailyRecords } from "./types";

const SOURCE_TRUST = 0.6;
const ROLLING_DAYS = 14;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const isPresent = (values: DirectCategory, day: NormalizedDailyRecords): boolean => {
  if (values === "sleep") {
    return day.sleepMinutes !== null;
  }

  if (values === "phone") {
    return day.lastPhoneUseAt !== null && day.phoneDurationMinutes !== null;
  }

  if (values === "meal") {
    return day.lastMealAt !== null;
  }

  if (values === "exercise") {
    return day.exerciseMinutes !== null;
  }

  if (values === "caffeine") {
    return day.caffeine.length > 0;
  }

  if (values === "alcohol") {
    return day.alcoholServings !== null;
  }

  if (values === "wellness") {
    return day.fatigueLevel !== null || day.stressLevel !== null;
  }

  return false;
};

const circularDeviation = (a: number, b: number): number => {
  const diff = Math.abs(((a - b + 720) % 1440) - 720);
  return diff;
};

export const clampToRange = (value: number, min = 0, max = 1): number => clamp(value, min, max);

export const estimateConfidenceLevelFromScore = (score: number, incomplete: boolean): ConfidenceLevel => {
  if (incomplete || score < 0) {
    return "insufficient";
  }

  if (score < 0.35) {
    return "low";
  }

  if (score < 0.70) {
    return "medium";
  }

  return "high";
};

const levelFromInputs = (params: { sampleScore: number; completeness: number; repeatability: number; incomplete: boolean }): ConfidenceLevel => (
  estimateConfidenceLevelFromScore(
    params.sampleScore * 0.40 + params.completeness * 0.30 + params.repeatability * 0.20 + SOURCE_TRUST * 0.10,
    params.incomplete,
  )
);

export const calculateConfidence = (input: {
  days: readonly NormalizedDailyRecords[];
  baseline: BaselineResult;
}): ConfidenceResult => {
  const days = input.days;

  const presentByCategory = {
    sleep: days.some((day) => isPresent("sleep", day)),
    phone: days.some((day) => isPresent("phone", day)),
    meal: days.some((day) => isPresent("meal", day)),
    exercise: days.some((day) => isPresent("exercise", day)),
    caffeine: days.some((day) => isPresent("caffeine", day)),
    alcohol: days.some((day) => isPresent("alcohol", day)),
    wellness: days.some((day) => isPresent("wellness", day)),
  } as const;

  const missingFields = (Object.entries(presentByCategory)
    .filter((entry) => entry[1] === false)
    .map(([key]) => key as DirectCategory))
    .sort();

  const sampleCount = input.baseline.sampleCount;
  const sampleScore = clampToRange(sampleCount / ROLLING_DAYS, 0, 1);

  const presentCategoryCount = 7 - missingFields.length;
  const completeness = clampToRange(presentCategoryCount / 7, 0, 1);

  const validBedWakeForRepeatability = days
    .filter((day) => day.sleepMinutes !== null && day.bedMinuteOfDay !== null && day.wakeMinuteOfDay !== null
      && day.bedMinuteOfDay >= 0 && day.wakeMinuteOfDay >= 0)
    .map((day) => ({
      bed: day.bedMinuteOfDay ?? 0,
      wake: day.wakeMinuteOfDay ?? 0,
    }))
    .filter((entry) => entry.bed >= 0 && entry.bed <= 1439 && entry.wake >= 0 && entry.wake <= 1439);

  let repeatability = 0;
  if (input.baseline.baselineBedMinuteOfDay !== null && input.baseline.baselineWakeMinuteOfDay !== null && validBedWakeForRepeatability.length > 0) {
    const baselineBed = input.baseline.baselineBedMinuteOfDay;
    const baselineWake = input.baseline.baselineWakeMinuteOfDay;
    const deviations = validBedWakeForRepeatability.flatMap((entry) => {
      return [
        circularDeviation(entry.bed, baselineBed),
        circularDeviation(entry.wake, baselineWake),
      ];
    });

    const meanDeviation = deviations.reduce((acc, value) => acc + value, 0) / deviations.length;
    repeatability = clampToRange(1 - meanDeviation / 120, 0, 1);
  }

  const incomplete = sampleCount < 3;
  if (incomplete) {
    return {
      score: 0,
      level: "insufficient",
      sampleScore,
      completeness,
      repeatability: 0,
      sourceTrust: SOURCE_TRUST,
      missingFields,
    };
  }

  const score = sampleScore * 0.40 + completeness * 0.30 + repeatability * 0.20 + SOURCE_TRUST * 0.10;
  const level = levelFromInputs({ sampleScore, completeness, repeatability, incomplete });

  return {
    score,
    level,
    sampleScore,
    completeness,
    repeatability,
    sourceTrust: SOURCE_TRUST,
    missingFields: missingFields.sort(),
  };
};
