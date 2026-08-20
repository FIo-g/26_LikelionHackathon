import type { ReadinessResult, ReadinessWeights } from "./types";
import { READINESS_WEIGHTS } from "./types";

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
  const { sleepDuration, regularity, caffeine, phone, mealExercise } = input;
  const missingFields = [] as Array<keyof typeof input>;

  if (sleepDuration === null) {
    missingFields.push("sleepDuration");
  }

  if (regularity === null) {
    missingFields.push("regularity");
  }

  if (caffeine === null) {
    missingFields.push("caffeine");
  }

  if (phone === null) {
    missingFields.push("phone");
  }

  if (mealExercise === null) {
    missingFields.push("mealExercise");
  }

  if (sleepDuration === null || regularity === null) {
    return {
      score: null,
      missingFields,
    };
  }

  const score = weightedAvailableScore({
    sleepDuration: toPercent(sleepDuration),
    regularity: toPercent(regularity),
    caffeine: toPercent(caffeine),
    phone: toPercent(phone),
    mealExercise: toPercent(mealExercise),
  });

  return {
    score: score,
    missingFields,
  };
};
