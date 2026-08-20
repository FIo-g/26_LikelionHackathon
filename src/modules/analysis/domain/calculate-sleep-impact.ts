import type { Evidence } from "@/shared/domain/contracts";
import { clampToRange, estimateConfidenceLevelFromScore } from "./calculate-confidence";
import { calculateCaffeineRemainingAtBed } from "./caffeine-decay";
import type {
  NormalizedDailyRecords,
  SleepImpactFactor,
  SleepImpactInput,
  SleepImpactResult,
} from "./types";

const CAFFEINE_REMAINING_THRESHOLD_MG = 50;
const PHONE_THRESHOLD_MINUTES = 60;
const MEAL_THRESHOLD_MINUTES = 180;
const EXERCISE_THRESHOLD_MINUTES = 120;

type CohortClassification = Readonly<{
  exposed: boolean;
  unexposed: boolean;
}>;

const neitherCohort: CohortClassification = { exposed: false, unexposed: false };

const classifyObserved = (exposed: boolean): CohortClassification => ({
  exposed,
  unexposed: !exposed,
});

const minuteByTimezone = (value: string, timezone: string): number | null => {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  } catch {
    return null;
  }
};

const minutesUntilBed = (observedMinute: number, targetBedMinuteOfDay: number): number => (
  (targetBedMinuteOfDay - observedMinute + 1440) % 1440
);

export const classifySleepImpactRow = (input: Readonly<{
  factor: SleepImpactFactor;
  row: NormalizedDailyRecords;
  timezone: string;
  targetBedMinuteOfDay: number;
}>): CohortClassification => {
  const { factor, row, timezone, targetBedMinuteOfDay } = input;

  if (factor === "caffeine") {
    if (row.caffeine.length === 0) {
      return neitherCohort;
    }

    const residuals = row.caffeine.flatMap((entry) => {
      const consumedMinute = minuteByTimezone(entry.consumedAt, timezone);
      if (consumedMinute === null) {
        return [];
      }
      return [calculateCaffeineRemainingAtBed(
        entry.caffeineMg,
        minutesUntilBed(consumedMinute, targetBedMinuteOfDay) / 60,
      )];
    });
    if (residuals.length === 0) {
      return neitherCohort;
    }
    return classifyObserved(residuals.reduce((sum, value) => sum + value, 0) >= CAFFEINE_REMAINING_THRESHOLD_MG);
  }

  if (factor === "alcohol") {
    return row.alcoholServings === null
      ? neitherCohort
      : classifyObserved(row.alcoholServings > 0);
  }

  const value = factor === "phone"
    ? row.lastPhoneUseAt
    : factor === "meal"
      ? row.lastMealAt
      : row.lastExerciseAt;
  if (!value) {
    return neitherCohort;
  }

  const observedMinute = minuteByTimezone(value, timezone);
  if (observedMinute === null) {
    return neitherCohort;
  }
  const distance = minutesUntilBed(observedMinute, targetBedMinuteOfDay);
  const threshold = factor === "phone"
    ? PHONE_THRESHOLD_MINUTES
    : factor === "meal"
      ? MEAL_THRESHOLD_MINUTES
      : EXERCISE_THRESHOLD_MINUTES;
  return classifyObserved(distance <= threshold);
};

const mean = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const evidenceDirection = (deltaMinutes: number): Evidence["direction"] => {
  if (deltaMinutes > 0) {
    return "positive";
  }

  if (deltaMinutes < 0) {
    return "negative";
  }

  return "neutral";
};

export const calculateSleepImpact = (input: SleepImpactInput): SleepImpactResult => {
  if (input.exposed.length < 3 || input.unexposed.length < 3) {
    return {
      factor: input.factor,
      exposedCount: input.exposed.length,
      unexposedCount: input.unexposed.length,
      deltaMinutes: null,
      confidence: "insufficient",
      evidence: [
        {
          code: "sleep-impact-insufficient-data",
          label: "노출군과 비노출군 데이터가 각각 최소 3개 이상 필요합니다.",
          direction: "neutral",
          value: null,
          count: null,
        },
      ],
    };
  }

  const exposedMean = mean(input.exposed);
  const unexposedMean = mean(input.unexposed);
  const deltaMinutes = exposedMean - unexposedMean;
  const sampleScore = clampToRange((input.exposed.length + input.unexposed.length) / 14, 0, 1);
  const confidence = estimateConfidenceLevelFromScore(sampleScore, false);

  return {
    factor: input.factor,
    exposedCount: input.exposed.length,
    unexposedCount: input.unexposed.length,
    deltaMinutes,
    confidence,
    evidence: [
      {
        code: deltaMinutes > 0
          ? "sleep-impact-positive-association"
          : deltaMinutes < 0
            ? "sleep-impact-negative-association"
            : "sleep-impact-neutral-association",
        label: `${input.factor} 노출군과 비노출군의 수면 시간 차이를 요약합니다.`,
        direction: evidenceDirection(deltaMinutes),
        value: Math.round(deltaMinutes * 100) / 100,
        count: input.exposed.length + input.unexposed.length,
      },
    ],
  };
};
