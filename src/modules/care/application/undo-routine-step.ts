import type { UserScope } from "@/shared/domain/contracts";
import type { RoutineStepKey } from "../domain/routine";
import { executeCareMutation, type CareMutationDependencies } from "./care-mutation";
import { goalRoutineRevisionKey, planDayRoutineRevisionKey } from "./ports";
import { carePlanDayQuery, resolveCarePlanDay } from "./care-date";

export const createUndoRoutineStepService = (scope: UserScope, dependencies: CareMutationDependencies = {}) => ({
  undo: async (command: Readonly<{ localDate: string; planDayId: string | null; routineRevisionKey: string; stepKey: RoutineStepKey; idempotencyKey: string }>): Promise<void> => (
    executeCareMutation(scope, "care.undoRoutineStep", command.idempotencyKey, command, dependencies, async (repository, clock) => {
      const resolved = await resolveCarePlanDay(scope, repository, clock.now());
      if (resolved.localDate !== command.localDate) throw new Error("ROUTINE_DAY_CLOSED");
      const activePlanDay = resolved.planDay ?? await repository.findActivePlanDay(carePlanDayQuery(scope, command.localDate));
      if (activePlanDay) {
        if (command.planDayId !== activePlanDay.id || command.routineRevisionKey !== planDayRoutineRevisionKey(activePlanDay.id)) throw new Error("ROUTINE_PLAN_DAY_UNAVAILABLE");
      } else {
        const goal = await repository.findGoal();
        if (command.planDayId !== null || !goal || command.routineRevisionKey !== goalRoutineRevisionKey(goal)) throw new Error("ROUTINE_PLAN_DAY_UNAVAILABLE");
      }
      await repository.undoStep(command.localDate, command.routineRevisionKey, command.planDayId, command.stepKey);
    })
  ),
});
