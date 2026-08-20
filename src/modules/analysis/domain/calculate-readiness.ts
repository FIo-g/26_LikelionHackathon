import type { ReadinessComponent, ReadinessResult, ReadinessWeights } from "./types";
import { READINESS_FIELD_ORDER, READINESS_WEIGHTS } from "./types";

const clamp = (value: number): number => {
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }

  if (rounded > 100) {
    return 100;
  }

  return rounded;
};

const toPercent = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }

  return clamp(value);
};

const isAvailable = (value: number | null): value is number => value !== null;

export const weightedAvailableScore = (values: Readonly<{ [key in keyof ReadinessWeights]: number | null }>): number | null => {
  const items = Object.entries(values) as ReadonlyArray<[keyof ReadinessWeights, number | null]>;
  const observed = items.filter(
    (entry): entry is [keyof ReadinessWeights, number] => isAvailable(entry[1]),
  );

  if (observed.length === 0) {
    return null;
  }

  const numerator = observed.reduce((acc, [key, value]) => acc + value * READINESS_WEIGHTS[key], 0);
  const denominator = observed.reduce((acc, [key]) => acc + READINESS_WEIGHTS[key], 0);

  return clamp(numerator / denominator);
};

export const calculateReadiness = (input: {
  sleepDuration: number | null;
  regularity: number | null;
  caffeine: number | null;
  phone: number | null;
  mealExercise: number | null;
}): ReadinessResult => {
  const missingFields: ReadinessComponent[] = READINESS_FIELD_ORDER.filter(
    (field) => input[field] === null,
  );

  if (input.sleepDuration === null) {
    return {
      score: null,
      missingFields,
    };
  }

  const score = weightedAvailableScore({
    sleepDuration: toPercent(input.sleepDuration),
    regularity: toPercent(input.regularity),
    caffeine: toPercent(input.caffeine),
    phone: toPercent(input.phone),
    mealExercise: toPercent(input.mealExercise),
  });

  return {
    score: score,
    missingFields,
  };
};
