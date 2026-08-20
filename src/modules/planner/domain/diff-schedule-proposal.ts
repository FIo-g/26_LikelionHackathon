import type { PlanDayTarget } from "./types";

export type ScheduleDiff = Readonly<{
  localDate: string;
  before: PlanDayTarget | null;
  after: PlanDayTarget;
}>;

const sameTarget = (left: PlanDayTarget, right: PlanDayTarget): boolean => (
  left.targetBedAt === right.targetBedAt
  && left.targetWakeAt === right.targetWakeAt
  && left.caffeineCutoffAt === right.caffeineCutoffAt
  && left.exerciseCutoffAt === right.exerciseCutoffAt
  && left.mealCutoffAt === right.mealCutoffAt
  && left.windDownAt === right.windDownAt
);

export const diffScheduleProposal = (
  currentDays: readonly PlanDayTarget[],
  proposedDays: readonly PlanDayTarget[],
): readonly ScheduleDiff[] => {
  const currentByDate = new Map(currentDays.map((day) => [day.localDate, day]));

  return proposedDays.flatMap((after) => {
    const before = currentByDate.get(after.localDate) ?? null;
    return before && sameTarget(before, after) ? [] : [{ localDate: after.localDate, before, after }];
  });
};
