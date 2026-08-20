import type { ConfidenceLevel, Evidence } from "@/shared/domain/contracts";

export type DirectCategory =
  | "sleep"
  | "phone"
  | "meal"
  | "exercise"
  | "caffeine"
  | "alcohol"
  | "wellness";

export type ReadinessComponent =
  | "sleepDuration"
  | "regularity"
  | "caffeine"
  | "phone"
  | "mealExercise";

export type SleepGoal = Readonly<{
  targetBedTime: string;
  targetWakeTime: string;
  targetDurationMinutes: number;
}>;

export type NormalizedCaffeineEntry = Readonly<{
  consumedAt: string;
  caffeineMg: number;
}>;

export type NormalizedDailyRecords = Readonly<{
  localDate: string;
  sleepMinutes: number | null;
  bedMinuteOfDay: number | null;
  wakeMinuteOfDay: number | null;
  caffeine: readonly NormalizedCaffeineEntry[];
  alcoholServings: number | null;
  lastPhoneUseAt: string | null;
  phoneDurationMinutes: number | null;
  exerciseMinutes: number | null;
  lastMealAt: string | null;
  fatigueLevel: number | null;
  stressLevel: number | null;
}>;

export type NormalizedAnalysisInput = Readonly<{
  localDate: string;
  timezone: string;
  goal: SleepGoal;
  days: readonly NormalizedDailyRecords[];
  computedAt: string;
}>;

export type ReadinessWeights = Readonly<{
  sleepDuration: 0.35;
  regularity: 0.25;
  caffeine: 0.20;
  phone: 0.10;
  mealExercise: 0.10;
}>;

export const READINESS_WEIGHTS: Readonly<ReadinessWeights> = {
  sleepDuration: 0.35,
  regularity: 0.25,
  caffeine: 0.20,
  phone: 0.10,
  mealExercise: 0.10,
} as const;

export type BaselineResult = Readonly<{
  baselineSleepMinutes: number | null;
  baselineBedMinuteOfDay: number | null;
  baselineWakeMinuteOfDay: number | null;
  sampleCount: number;
  excludedCount: number;
  confidence: ConfidenceLevel;
}>;

export type ReadinessResult = Readonly<{
  score: number | null;
  missingFields: readonly ReadinessComponent[];
}>;

export type ConfidenceResult = Readonly<{
  score: number;
  level: ConfidenceLevel;
  sampleScore: number;
  completeness: number;
  repeatability: number;
  sourceTrust: number;
  missingFields: readonly DirectCategory[];
}>;

export type SleepImpactFactor = "caffeine" | "phone" | "alcohol" | "meal" | "exercise";

export type SleepImpactInput = Readonly<{
  factor: SleepImpactFactor;
  exposed: readonly number[];
  unexposed: readonly number[];
}>;

export type SleepImpactResult = Readonly<{
  factor: SleepImpactFactor;
  exposedCount: number;
  unexposedCount: number;
  deltaMinutes: number | null;
  confidence: ConfidenceLevel;
  evidence: readonly Evidence[];
}>;

export type DataBasis = Readonly<{
  periodStart: string;
  periodEnd: string;
  sampleCount: number;
  excludedCount: number;
  missingFields: readonly DirectCategory[];
  completenessByCategory: Readonly<Record<DirectCategory, number>>;
  sourceDistribution: Readonly<Record<"manual", number>>;
  computedAt: string;
  algorithmVersion: "provisional-v1";
  confidence: ConfidenceLevel;
}>;

export type AnalysisResult = Readonly<{
  readiness: number | null;
  confidence: ConfidenceLevel;
  metrics: Readonly<{
    sleepRhythmStability: number | null;
    phoneWindDown: number | null;
    caffeineSignal: number | null;
    sleepGoalAttainment: number | null;
  }>;
  dataBasis: DataBasis;
  evidence: readonly Evidence[];
  missingFields: readonly ReadinessComponent[];
}>;
