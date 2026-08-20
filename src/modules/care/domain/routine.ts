import type { PlanDayTarget } from "@/modules/planner/domain/types";

export type RoutineStepKey = "caffeine-cutoff" | "exercise-cutoff" | "meal-cutoff" | "phone-wind-down" | "target-bed";

export type RoutineDefinition = Readonly<{
  key: RoutineStepKey;
  label: string;
  scheduledAt: Date;
}>;

export type RoutineStepViewModel = RoutineDefinition & Readonly<{
  status: "done" | "current" | "upcoming";
}>;

export const routineFromPlanDay = (planDay: PlanDayTarget): readonly RoutineDefinition[] => [
  { key: "caffeine-cutoff", label: "카페인 마무리", scheduledAt: new Date(planDay.caffeineCutoffAt) },
  { key: "exercise-cutoff", label: "운동 마무리", scheduledAt: new Date(planDay.exerciseCutoffAt) },
  { key: "meal-cutoff", label: "저녁 식사 마무리", scheduledAt: new Date(planDay.mealCutoffAt) },
  { key: "phone-wind-down", label: "폰 정리", scheduledAt: new Date(planDay.windDownAt) },
  { key: "target-bed", label: "잠자리", scheduledAt: new Date(planDay.targetBedAt) },
];

export const deriveRoutineTimeline = (
  steps: readonly RoutineDefinition[],
  completedKeys: ReadonlySet<string>,
  now: Date,
): readonly RoutineStepViewModel[] => {
  const currentKey = steps.find((step) => !completedKeys.has(step.key) && step.scheduledAt <= now)?.key ?? null;
  return steps.map((step) => ({
    ...step,
    status: completedKeys.has(step.key) ? "done" : step.key === currentKey ? "current" : "upcoming",
  }));
};
