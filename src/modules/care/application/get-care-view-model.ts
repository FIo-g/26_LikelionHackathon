import { Temporal } from "@js-temporal/polyfill";
import { generateGoalPlanTargets } from "@/modules/planner/domain/generate-schedule-proposal";
import type { PlanDayTarget } from "@/modules/planner/domain/types";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { systemClock } from "@/shared/time/system-clock";
import { deriveRoutineTimeline, routineFromPlanDay, type RoutineStepViewModel } from "../domain/routine";
import { createPrismaCareRepository } from "../infrastructure/prisma-care-repository";
import { goalRoutineRevisionKey, planDayRoutineRevisionKey, type CareRepository, type CarePhoneUsage } from "./ports";
import { carePlanDayQuery, resolveCarePlanDay } from "./care-date";

export type CareViewModel = Readonly<{
  localDate: string;
  timezone: string;
  activePlanDayId: string | null;
  routineRevisionKey: string | null;
  planDay: PlanDayTarget | null;
  inputState: "needs-input" | "complete";
  routineSteps: readonly RoutineStepViewModel[];
  rerouteAdvice: Readonly<{ id: string }> | null;
  phonePattern: Readonly<{ sampleCount: number; averageDurationMinutes: number }> | null;
  tomorrowPlan: PlanDayTarget | null;
}>;

const phonePatternFrom = (entries: readonly CarePhoneUsage[]): CareViewModel["phonePattern"] => {
  const byLocalDate = new Map<string, number>();
  for (const entry of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.localDate)) continue;
    if (!Number.isInteger(entry.durationMinutes) || entry.durationMinutes < 0 || entry.durationMinutes > 24 * 60) continue;
    if (!byLocalDate.has(entry.localDate)) byLocalDate.set(entry.localDate, entry.durationMinutes);
  }

  const values = [...byLocalDate.values()].slice(0, 7);
  if (values.length < 3) return null;
  return {
    sampleCount: values.length,
    averageDurationMinutes: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
  };
};

export const getCareViewModel = async (
  scope: UserScope,
  dependencies: Readonly<{ clock?: Clock; repository?: CareRepository; getPrisma?: () => TransactionClient }> = {},
): Promise<CareViewModel> => {
  const clock = dependencies.clock ?? systemClock;
  const repository = dependencies.repository ?? createPrismaCareRepository((dependencies.getPrisma ?? getPrismaClient)(), scope);
  const now = clock.now();
  const resolved = await resolveCarePlanDay(scope, repository, now);
  const localDate = resolved.localDate;
  const activePlanDay = resolved.planDay;
  const goal = activePlanDay ? null : await repository.findGoal();
  const planDay = activePlanDay ?? (goal
    ? generateGoalPlanTargets(goal, scope.timezone, now, 2).find((day) => new Date(day.targetWakeAt) > now) ?? null
    : null);
  const routineRevisionKey = activePlanDay ? planDayRoutineRevisionKey(activePlanDay.id) : goal ? goalRoutineRevisionKey(goal) : null;
  const tomorrowLocalDate = Temporal.PlainDate.from(localDate).add({ days: 1 }).toString();
  const [completed, rerouteAdvice, phoneUsage, persistedTomorrowPlan] = await Promise.all([
    routineRevisionKey ? repository.listCompletions(localDate, routineRevisionKey) : Promise.resolve(new Set<string>()),
    repository.findGeneratedRerouteAdvice?.() ?? Promise.resolve(null),
    repository.listRecentPhoneUsage?.(7) ?? Promise.resolve([]),
    repository.findActivePlanDay(carePlanDayQuery(scope, tomorrowLocalDate)),
  ]);

  return {
    localDate,
    timezone: scope.timezone,
    activePlanDayId: activePlanDay?.id ?? null,
    routineRevisionKey,
    planDay,
    inputState: planDay ? "complete" : "needs-input",
    routineSteps: planDay ? deriveRoutineTimeline(routineFromPlanDay(planDay), completed, now) : [],
    rerouteAdvice,
    phonePattern: phonePatternFrom(phoneUsage),
    // Only an accepted, persisted PlanDay may appear as a next-plan card. A
    // goal-derived target remains useful for the routine but is not a saved plan.
    tomorrowPlan: persistedTomorrowPlan?.localDate === tomorrowLocalDate ? persistedTomorrowPlan : null,
  };
};
