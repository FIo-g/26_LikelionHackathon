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

const hasProvisionalConflict = (
  trigger: RerouteTrigger,
  windowDays: readonly PlanDayEntity[],
  sleepReferenceDays: readonly PlanDayEntity[],
): boolean => {
  const { input } = trigger;

  if (input.type === "caffeine") return dayForInstant(windowDays, input.consumedAt, "caffeineCutoffAt") !== null;
  if (input.type === "meal") return dayForInstant(windowDays, input.eatenAt, "mealCutoffAt") !== null;
  if (input.type === "exercise") return dayForInstant(windowDays, input.endedAt, "exerciseCutoffAt") !== null;
  if (input.type === "phone-usage") return dayForInstant(windowDays, input.lastUseAt, "windDownAt") !== null;
  if (input.type === "alcohol") return dayForInstant(windowDays, input.consumedAt, "windDownAt") !== null;
  if (input.type !== "sleep") return false;

  // The night that just ended has a targetBedAt in the past, so it is excluded from
  // `windowDays` (future-only). Match against the full active set instead, or an
  // on-time sleep gets compared against the NEXT night's wake target.
  const planDay = [...sleepReferenceDays].sort((left, right) => (
    Math.abs(new Date(left.targetWakeAt).getTime() - input.endedAt.getTime())
      - Math.abs(new Date(right.targetWakeAt).getTime() - input.endedAt.getTime())
  ))[0];
  if (!planDay) return false;

  const wakeDrift = Math.abs(minutesBetween(new Date(planDay.targetWakeAt), input.endedAt));
  const plannedDuration = minutesBetween(new Date(planDay.targetBedAt), new Date(planDay.targetWakeAt));
  const actualDuration = minutesBetween(input.startedAt, input.endedAt);
  return wakeDrift > WAKE_DRIFT_MINUTES || plannedDuration - actualDuration > DURATION_SHORTFALL_MINUTES;
};

export const rerouteTriggerInstant = (trigger: RerouteTrigger): Date => {
  const { input } = trigger;
  if (input.type === "sleep" || input.type === "exercise") return input.endedAt;
  if (input.type === "caffeine" || input.type === "alcohol") return input.consumedAt;
  if (input.type === "meal") return input.eatenAt;
  if (input.type === "phone-usage") return input.lastUseAt;
  return new Date(`${input.localDate}T00:00:00.000Z`);
};

export const selectReroutePlanDays = (
  activeDays: readonly PlanDayEntity[],
  trigger: RerouteTrigger,
  now: Date,
): readonly PlanDayEntity[] => {
  const threshold = Math.max(now.getTime(), rerouteTriggerInstant(trigger).getTime());
  return activeDays
    .filter((day) => day.status === "active" && new Date(day.targetBedAt).getTime() > threshold)
    .slice()
    .sort((left, right) => left.localDate.localeCompare(right.localDate) || left.id.localeCompare(right.id));
};

export const generateRerouteProposal = (input: RerouteProposalInput): ScheduleProposal | null => {
  const futureDays = selectReroutePlanDays(input.activeDays, input.trigger, input.now);
  const activeDays = input.activeDays.filter((day) => day.status === "active");
  if (!hasProvisionalConflict(input.trigger, futureDays, activeDays)) return null;
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
