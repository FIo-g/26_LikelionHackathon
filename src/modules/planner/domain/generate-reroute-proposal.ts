import { createPlannerInputHash, generateScheduleProposal } from "./generate-schedule-proposal";
import type { CreateRecordInput } from "@/modules/records/domain/types";
import type { PlanDayEntity, PlannerBaselineSnapshot, PlannerGoal, ScheduleProposal } from "./types";

const REROUTE_SHIFT_MINUTES = 15;
const WAKE_DRIFT_MINUTES = 30;
const DURATION_SHORTFALL_MINUTES = 45;

export type RerouteTrigger = Readonly<{
  recordId: string;
  input: CreateRecordInput;
}>;

export type RerouteProposalInput = Readonly<{
  timezone: string;
  goal: PlannerGoal;
  baseline: PlannerBaselineSnapshot | null;
  trigger: RerouteTrigger;
  activeDays: readonly PlanDayEntity[];
  now: Date;
}>;

const shiftInstant = (instant: string): string => (
  new Date(new Date(instant).getTime() + REROUTE_SHIFT_MINUTES * 60 * 1000).toISOString()
);

const shiftDay = (day: PlanDayEntity) => ({
  localDate: day.localDate,
  targetBedAt: shiftInstant(day.targetBedAt),
  targetWakeAt: shiftInstant(day.targetWakeAt),
  caffeineCutoffAt: shiftInstant(day.caffeineCutoffAt),
  exerciseCutoffAt: shiftInstant(day.exerciseCutoffAt),
  mealCutoffAt: shiftInstant(day.mealCutoffAt),
  windDownAt: shiftInstant(day.windDownAt),
});

const minutesBetween = (left: Date, right: Date): number => Math.round((right.getTime() - left.getTime()) / 60_000);

const dayForInstant = (
  activeDays: readonly PlanDayEntity[],
  instant: Date,
  cutoff: keyof Pick<PlanDayEntity, "caffeineCutoffAt" | "exerciseCutoffAt" | "mealCutoffAt" | "windDownAt">,
): PlanDayEntity | null => (
  activeDays.find((day) => (
    instant.getTime() > new Date(day[cutoff]).getTime()
      && instant.getTime() <= new Date(day.targetWakeAt).getTime()
  )) ?? null
);

const hasProvisionalConflict = (trigger: RerouteTrigger, activeDays: readonly PlanDayEntity[]): boolean => {
  const { input } = trigger;

  if (input.type === "caffeine") return dayForInstant(activeDays, input.consumedAt, "caffeineCutoffAt") !== null;
  if (input.type === "meal") return dayForInstant(activeDays, input.eatenAt, "mealCutoffAt") !== null;
  if (input.type === "exercise") return dayForInstant(activeDays, input.endedAt, "exerciseCutoffAt") !== null;
  if (input.type === "phone-usage") return dayForInstant(activeDays, input.lastUseAt, "windDownAt") !== null;
  if (input.type === "alcohol") return dayForInstant(activeDays, input.consumedAt, "windDownAt") !== null;
  if (input.type !== "sleep") return false;

  const planDay = [...activeDays].sort((left, right) => (
    Math.abs(new Date(left.targetWakeAt).getTime() - input.endedAt.getTime())
      - Math.abs(new Date(right.targetWakeAt).getTime() - input.endedAt.getTime())
  ))[0];
  if (!planDay) return false;

  const wakeDrift = Math.abs(minutesBetween(new Date(planDay.targetWakeAt), input.endedAt));
  const plannedDuration = minutesBetween(new Date(planDay.targetBedAt), new Date(planDay.targetWakeAt));
  const actualDuration = minutesBetween(input.startedAt, input.endedAt);
  return wakeDrift > WAKE_DRIFT_MINUTES || plannedDuration - actualDuration > DURATION_SHORTFALL_MINUTES;
};

export const generateRerouteProposal = (input: RerouteProposalInput): ScheduleProposal | null => {
  if (!hasProvisionalConflict(input.trigger, input.activeDays)) return null;

  const futureDays = input.activeDays.filter((day) => new Date(day.targetBedAt).getTime() > input.now.getTime());
  const firstFutureDay = futureDays[0];
  if (!firstFutureDay) return null;

  const seed = generateScheduleProposal({
    timezone: input.timezone,
    goal: input.goal,
    baseline: input.baseline,
    event: {
      id: input.trigger.recordId,
      type: "reroute",
      startsAt: firstFutureDay.targetWakeAt,
      desiredWakeAt: shiftInstant(firstFutureDay.targetWakeAt),
    },
  });

  return {
    adjustmentStartsOn: firstFutureDay.localDate,
    eventWakeAt: shiftInstant(firstFutureDay.targetWakeAt),
    days: futureDays.map(shiftDay),
    conflicts: seed.conflicts,
    confidence: seed.confidence,
    evidence: seed.evidence,
    algorithmVersion: "provisional-v1",
  };
};

export const createRerouteInputHash = (input: unknown): string => createPlannerInputHash(input);
