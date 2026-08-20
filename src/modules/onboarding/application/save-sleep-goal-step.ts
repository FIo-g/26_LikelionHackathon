import { createOnboardingRepository } from "../infrastructure/prisma-onboarding-repository";
import type { SleepGoalInput } from "../domain/types";

export const saveSleepGoalStep = async (
  userId: string,
  input: SleepGoalInput,
): Promise<void> => {
  const repository = createOnboardingRepository(userId);
  await repository.saveSleepGoal(input);
};
