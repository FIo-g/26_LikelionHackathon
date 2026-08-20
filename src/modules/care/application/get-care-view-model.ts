import { generateGoalPlanTargets } from "@/modules/planner/domain/generate-schedule-proposal";
import type { PlanDayTarget } from "@/modules/planner/domain/types";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { systemClock } from "@/shared/time/system-clock";
import { deriveRoutineTimeline, routineFromPlanDay, type RoutineStepViewModel } from "../domain/routine";
import { createPrismaCareRepository } from "../infrastructure/prisma-care-repository";
import { goalRoutineRevisionKey, planDayRoutineRevisionKey, type CareRepository } from "./ports";
import { resolveCarePlanDay } from "./care-date";

export type CareViewModel = Readonly<{
  localDate: string;
  timezone: string;
  activePlanDayId: string | null;
  routineRevisionKey: string | null;
  planDay: PlanDayTarget | null;
  inputState: "needs-input" | "complete";
  routineSteps: readonly RoutineStepViewModel[];
}>;

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
  const completed = routineRevisionKey ? await repository.listCompletions(localDate, routineRevisionKey) : new Set<string>();

  return {
    localDate,
    timezone: scope.timezone,
    activePlanDayId: activePlanDay?.id ?? null,
    routineRevisionKey,
    planDay,
    inputState: planDay ? "complete" : "needs-input",
    routineSteps: planDay ? deriveRoutineTimeline(routineFromPlanDay(planDay), completed, now) : [],
  };
};
