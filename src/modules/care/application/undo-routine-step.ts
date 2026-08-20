import type { UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import type { RoutineStepKey } from "../domain/routine";
import { executeCareMutation, type CareMutationDependencies } from "./care-mutation";
import { goalRoutineRevisionKey, planDayRoutineRevisionKey } from "./ports";

export const createUndoRoutineStepService = (scope: UserScope, dependencies: CareMutationDependencies = {}) => ({
  undo: async (command: Readonly<{ localDate: string; planDayId: string | null; routineRevisionKey: string; stepKey: RoutineStepKey; idempotencyKey: string }>): Promise<void> => (
    executeCareMutation(scope, "care.undoRoutineStep", command.idempotencyKey, command, dependencies, async (repository, clock) => {
      if (wakeLocalDate(clock.now(), scope.timezone) !== command.localDate) throw new Error("ROUTINE_DAY_CLOSED");
      const activePlanDay = await repository.findActivePlanDay(command.localDate);
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
