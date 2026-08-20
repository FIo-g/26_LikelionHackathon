import type { UserScope } from "@/shared/domain/contracts";
import { careToolFor, type CareToolKey } from "../domain/tool-catalog";
import { executeCareMutation, type CareMutationDependencies } from "./care-mutation";

export const createStartCareToolService = (scope: UserScope, dependencies: CareMutationDependencies = {}) => ({
  start: async (command: Readonly<{ localDate: string; toolKey: CareToolKey; plannedDurationSeconds: number; idempotencyKey: string }>): Promise<{ sessionId: string }> => {
    const tool = careToolFor(command.toolKey);
    const plannedDurationSeconds = Math.min(tool.defaultSeconds, Math.max(1, Math.floor(command.plannedDurationSeconds || tool.defaultSeconds)));
    return executeCareMutation(scope, "care.startTool", command.idempotencyKey, command, dependencies, (repository, clock) => (
      repository.startTool({ localDate: command.localDate, toolKey: command.toolKey, plannedDurationSeconds, startedAt: clock.now() })
    ));
  },
});
