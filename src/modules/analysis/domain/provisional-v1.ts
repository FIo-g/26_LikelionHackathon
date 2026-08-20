import { calculateBaseline } from "./calculate-baseline";
import { calculateConfidence } from "./calculate-confidence";
import { calculateReadiness } from "./calculate-readiness";
import { calculateCaffeineRemainingAtBed } from "./caffeine-decay";
import { Temporal } from "@js-temporal/polyfill";
import type {
  AnalysisResult,
  DirectCategory,
  NormalizedAnalysisInput,
  NormalizedDailyRecords,
  ReadinessResult,
} from "./types";

const BASELINE_WINDOW_MIN = 3;

const isValidLocalDate = (value: string): boolean => {
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
};

const clamp = (value: number, min = 0, max = 100): number => {
  return Math.max(min, Math.min(max, Math.round(value)));
};

const parseTimeToMinute = (time: string): number | null => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const parseMinuteByTimezone = (timezone: string, value: string): number | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(parsed);
  } catch {
    return null;
  }

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
};

const forwardMinutes = (fromMinute: number, toMinute: number): number => {
  const normalizedFrom = ((fromMinute % 1440) + 1440) % 1440;
  const normalizedTo = ((toMinute % 1440) + 1440) % 1440;
  return (normalizedTo - normalizedFrom + 1440) % 1440;
};

const circularDeviationMinutes = (a: number, b: number): number => {
  return Math.abs(((a - b + 720) % 1440) - 720);
};

const sortedByDate = (days: readonly NormalizedDailyRecords[]): NormalizedDailyRecords[] => {
  return [...days].sort((left, right) => left.localDate.localeCompare(right.localDate));
};

const isValidSleepDay = (day: NormalizedDailyRecords): boolean => (
  isValidLocalDate(day.localDate)
    && day.sleepMinutes !== null
    && Number.isFinite(day.sleepMinutes)
    && day.sleepMinutes >= 120
    && day.sleepMinutes <= 960
    && day.bedMinuteOfDay !== null
    && day.wakeMinuteOfDay !== null
);

const directCategoryCoverage = (days: readonly NormalizedDailyRecords[]) => {
  const hasSleep = days.some((day) => day.sleepMinutes !== null);
  const hasPhone = days.some((day) => day.lastPhoneUseAt !== null);
  const hasMeal = days.some((day) => day.lastMealAt !== null);
  const hasExercise = days.some((day) => day.exerciseMinutes !== null);
  const hasCaffeine = days.some((day) => day.caffeine.length > 0);
  const hasAlcohol = days.some((day) => day.alcoholServings !== null);
  const hasWellness = days.some((day) => day.fatigueLevel !== null || day.stressLevel !== null);

  return {
    sleep: Number(hasSleep),
    phone: Number(hasPhone),
    meal: Number(hasMeal),
    exercise: Number(hasExercise),
    caffeine: Number(hasCaffeine),
    alcohol: Number(hasAlcohol),
    wellness: Number(hasWellness),
  };
};

const missingDirectCategories = (days: readonly NormalizedDailyRecords[]): ReadonlyArray<DirectCategory> => {
  return Object.entries(directCategoryCoverage(days))
    .filter((entry) => entry[1] === 0)
    .map(([category]) => category as DirectCategory)
    .sort();
};

const buildDataBasis = (
  input: NormalizedAnalysisInput,
  baselineSampleCount: number,
  baselineExcludedCount: number,
  confidence: Readonly<{ level: "insufficient" | "low" | "medium" | "high" }>,
) => {
  const ordered = sortedByDate(input.days).filter((day) => isValidLocalDate(day.localDate));
  const periodStart = ordered[0]?.localDate ?? input.localDate;
  const periodEnd = ordered[ordered.length - 1]?.localDate ?? input.localDate;

  return {
    periodStart: isValidLocalDate(periodStart) ? periodStart : input.localDate,
    periodEnd: isValidLocalDate(periodEnd) ? periodEnd : input.localDate,
    sampleCount: baselineSampleCount,
    excludedCount: baselineExcludedCount,
    missingFields: missingDirectCategories(input.days),
    completenessByCategory: directCategoryCoverage(input.days),
    sourceDistribution: {
      manual: 1,
    },
    computedAt: input.computedAt,
    algorithmVersion: "provisional-v1" as const,
    confidence: confidence.level,
  };
};

const buildReadinessMissingEvidence = (
  readiness: ReadinessResult,
): AnalysisResult["evidence"] => {
  const evidence: Array<AnalysisResult["evidence"][number]> = [];

  if (readiness.missingFields.includes("sleepDuration")) {
    evidence.push({
      code: "readiness-missing-sleep-duration",
      label: "수면 시간 점수를 계산할 수 있는 기준 수면 길이 데이터가 부족합니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  }

  if (readiness.missingFields.includes("regularity")) {
    evidence.push({
      code: "readiness-missing-regularity",
      label: "수면 규칙성 점수를 계산할 수 있는 취침/기상 기록이 부족합니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  }

  if (readiness.missingFields.includes("caffeine")) {
    evidence.push({
      code: "readiness-missing-caffeine",
      label: "카페인 잔류 데이터가 없어 카페인 감점 신호를 반영할 수 없습니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  }

  if (readiness.missingFields.includes("phone")) {
    evidence.push({
      code: "readiness-missing-phone",
      label: "취침 직전 휴대폰 사용 데이터가 없어 풍선 단계 신호를 계산할 수 없습니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  }

  if (readiness.missingFields.includes("mealExercise")) {
    evidence.push({
      code: "readiness-missing-meal-exercise",
      label: "식사/운동 기록이 적어 규칙/운동 보강 신호를 계산할 수 없습니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  }

  return evidence;
};

const buildEvidence = (
  input: NormalizedAnalysisInput,
  baselineConfidence: "insufficient" | "low" | "medium" | "high",
  confidenceLevel: "insufficient" | "low" | "medium" | "high",
  sampleCount: number,
  readiness: ReadinessResult,
  metrics: {
    sleepRhythmStability: number | null;
    phoneWindDown: number | null;
    caffeineSignal: number | null;
    sleepGoalAttainment: number | null;
  },
): AnalysisResult["evidence"] => {
  const evidence: Array<AnalysisResult["evidence"][number]> = [];

  if (sampleCount < BASELINE_WINDOW_MIN || baselineConfidence === "insufficient") {
    evidence.push({
      code: "baseline-too-few-samples",
      label: "기준 수면 데이터가 3일 미만이라 분석 신뢰도가 낮습니다.",
      direction: "neutral",
      value: sampleCount,
      count: sampleCount,
    });
  }

  if (confidenceLevel === "insufficient" || confidenceLevel === "low") {
    evidence.push({
      code: "confidence-low-sample",
      label: "신뢰도 계산용 표본이 충분하지 않습니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  } else if (confidenceLevel === "medium") {
    evidence.push({
      code: "baseline-confidence-insufficient",
      label: "신뢰도는 보수적으로 계산했습니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  }

  if (metrics.sleepRhythmStability === null && input.days.length >= BASELINE_WINDOW_MIN) {
    evidence.push({
      code: "sleep-regularity-missing-days",
      label: "규칙성 계산을 위한 취침/기상 분산값이 충분하지 않습니다.",
      direction: "neutral",
      value: null,
      count: 1,
    });
  }

  evidence.push(...buildReadinessMissingEvidence(readiness));

  const directCounts = Object.values(directCategoryCoverage(input.days));
  if (directCounts.some((count) => count === 0)) {
    evidence.push({
      code: "confidence-incomplete-direct-data",
      label: "직접 입력 항목 일부가 비어 있어 신호 완성도가 낮습니다.",
      direction: "neutral",
      value: null,
      count: directCounts.filter((value) => value > 0).length,
    });
  }

  return evidence;
};

const buildValidSleepRows = (days: readonly NormalizedDailyRecords[]): NormalizedDailyRecords[] => {
  const seenDates = new Set<string>();
  return days
    .map((day) => day)
    .filter((day) => {
      if (!isValidLocalDate(day.localDate)) {
        return false;
      }

      if (seenDates.has(day.localDate)) {
        return false;
      }

      seenDates.add(day.localDate);
      return isValidSleepDay(day);
    });
};

const computeSleepGoalAttainment = (baselineSleepMinutes: number | null, targetDurationMinutes: number): number | null => {
  if (baselineSleepMinutes === null || !Number.isFinite(targetDurationMinutes) || targetDurationMinutes <= 0) {
    return null;
  }

  return clamp((baselineSleepMinutes / targetDurationMinutes) * 100);
};

const computeSleepRhythmStability = (
  rows: readonly NormalizedDailyRecords[],
  baselineBedMinuteOfDay: number | null,
  baselineWakeMinuteOfDay: number | null,
): number | null => {
  if (baselineBedMinuteOfDay === null || baselineWakeMinuteOfDay === null) {
    return null;
  }

  const deviations = rows
    .filter((row) => row.bedMinuteOfDay !== null && row.wakeMinuteOfDay !== null)
    .map((row) => {
      const bedDeviation = circularDeviationMinutes(row.bedMinuteOfDay ?? 0, baselineBedMinuteOfDay);
      const wakeDeviation = circularDeviationMinutes(row.wakeMinuteOfDay ?? 0, baselineWakeMinuteOfDay);
      return (bedDeviation + wakeDeviation) / 2;
    });

  if (deviations.length === 0) {
    return null;
  }

  const averageDeviation = deviations.reduce((acc, value) => acc + value, 0) / deviations.length;
  return clamp(100 - (averageDeviation * 100) / 120);
};

const computeCaffeineSignal = (rows: readonly NormalizedDailyRecords[], timezone: string, targetBed: number): number | null => {
  const nightlyRemaining = rows
    .filter((day) => day.bedMinuteOfDay !== null)
    .map((day) => {
      const bedMinute = day.bedMinuteOfDay ?? targetBed;
      const remaining = day.caffeine
        .map((entry) => {
          const consumedMinute = parseMinuteByTimezone(timezone, entry.consumedAt);
          if (consumedMinute === null) {
            return null;
          }

          const hoursSinceConsumption = forwardMinutes(consumedMinute, bedMinute) / 60;
          return calculateCaffeineRemainingAtBed(entry.caffeineMg, hoursSinceConsumption);
        })
        .filter((value): value is number => value !== null)
        .reduce((acc, value) => acc + value, 0);

      return remaining > 0 ? remaining : null;
    })
    .filter((value): value is number => value !== null);

  if (nightlyRemaining.length === 0) {
    return null;
  }

  const averageRemaining = nightlyRemaining.reduce((acc, value) => acc + value, 0) / nightlyRemaining.length;
  return clamp(100 - averageRemaining);
};

const computePhoneWindDown = (rows: readonly NormalizedDailyRecords[], timezone: string, targetBed: number): number | null => {
  const values = rows
    .filter((day) => day.lastPhoneUseAt !== null)
    .map((day) => {
      const lastUseMinute = parseMinuteByTimezone(timezone, day.lastPhoneUseAt ?? "");
      if (lastUseMinute === null) {
        return null;
      }

      const bedMinute = day.bedMinuteOfDay ?? targetBed;
      const minutesToBed = forwardMinutes(lastUseMinute, bedMinute);
      return clamp((minutesToBed / 60) * 100, 0, 100);
    })
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const computeMealExerciseSignal = (rows: readonly NormalizedDailyRecords[], timezone: string, targetBed: number): number | null => {
  const values = rows.flatMap((row) => {
    const result: number[] = [];

    if (row.lastMealAt !== null) {
      const mealMinute = parseMinuteByTimezone(timezone, row.lastMealAt);
      if (mealMinute !== null) {
        const minutesToBed = forwardMinutes(mealMinute, row.bedMinuteOfDay ?? targetBed);
        result.push(minutesToBed >= 180 ? 100 : 0);
      }
    }

    if (row.lastExerciseAt) {
      const exerciseMinute = parseMinuteByTimezone(timezone, row.lastExerciseAt);
      if (exerciseMinute !== null) {
        const minutesToBed = forwardMinutes(exerciseMinute, row.bedMinuteOfDay ?? targetBed);
        result.push(minutesToBed >= 120 ? 100 : 0);
      }
    }

    return result;
  });

  if (values.length === 0) {
    return null;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

export const calculateAnalysis = (input: NormalizedAnalysisInput): AnalysisResult => {
  const targetBed = parseTimeToMinute(input.goal.targetBedTime) ?? 1320;
  const targetDurationMinutes = input.goal.targetDurationMinutes;

  const baseline = calculateBaseline(input);
  const validSleepRows = buildValidSleepRows(input.days);

  const sleepRhythmStability = computeSleepRhythmStability(
    validSleepRows,
    baseline.baselineBedMinuteOfDay,
    baseline.baselineWakeMinuteOfDay,
  );

  const sleepGoalAttainment = computeSleepGoalAttainment(
    baseline.baselineSleepMinutes,
    targetDurationMinutes,
  );

  const caffeineSignal = computeCaffeineSignal(input.days, input.timezone, targetBed);
  const phoneWindDown = computePhoneWindDown(input.days, input.timezone, targetBed);
  const mealExercise = computeMealExerciseSignal(input.days, input.timezone, targetBed);

  const readiness = calculateReadiness({
    sleepDuration: sleepGoalAttainment,
    regularity: sleepRhythmStability,
    caffeine: caffeineSignal,
    phone: phoneWindDown,
    mealExercise,
  });

  const confidence = calculateConfidence({
    days: input.days,
    baseline,
  });

  const dataBasis = buildDataBasis(input, baseline.sampleCount, baseline.excludedCount, confidence);

  const evidence = buildEvidence(
    input,
    baseline.confidence,
    confidence.level,
    baseline.sampleCount,
    readiness,
    {
      sleepRhythmStability,
      phoneWindDown,
      caffeineSignal,
      sleepGoalAttainment,
    },
  );

  return {
    readiness: readiness.score,
    confidence: confidence.level,
    metrics: {
      sleepRhythmStability,
      phoneWindDown,
      caffeineSignal,
      sleepGoalAttainment,
    },
    dataBasis,
    evidence,
    missingFields: readiness.missingFields,
  };
};
