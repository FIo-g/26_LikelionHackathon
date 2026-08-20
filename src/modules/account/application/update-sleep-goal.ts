import type { UserScope } from "@/shared/domain/contracts";
import { accountSleepGoalSchema } from "../domain/schemas";
import { createPrismaAccountRepository } from "../infrastructure/prisma-account-repository";
import type { AccountRepository } from "./ports";

export const createUpdateSleepGoalService = (
  scope: UserScope,
  dependencies: Readonly<{ repository?: AccountRepository }> = {},
) => {
  const repository = dependencies.repository ?? createPrismaAccountRepository();
  return {
    update: async (input: unknown): Promise<void> => {
      const parsed = accountSleepGoalSchema.parse({
        targetBedTime: (input as { targetBedTime?: unknown }).targetBedTime,
        targetWakeTime: (input as { targetWakeTime?: unknown }).targetWakeTime,
      });
      await repository.updateSleepGoal(scope, parsed);
    },
  };
};
