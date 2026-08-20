import type { UserScope } from "@/shared/domain/contracts";
import { executeCareMutation, type CareMutationDependencies } from "./care-mutation";

export const createCompleteCareToolService = (scope: UserScope, dependencies: CareMutationDependencies = {}) => ({
  complete: async (command: Readonly<{ sessionId: string; idempotencyKey: string }>): Promise<void> => (
    executeCareMutation(scope, "care.completeTool", command.idempotencyKey, command, dependencies, (repository, clock) => (
      repository.completeTool(command.sessionId, clock.now())
    ))
  ),
});
