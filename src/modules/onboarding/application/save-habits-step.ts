import { createOnboardingRepository } from "../infrastructure/prisma-onboarding-repository";
import type { HabitValues } from "../domain/types";

export const saveHabitsStep = async (
  userId: string,
  input: HabitValues,
): Promise<void> => {
  const repository = createOnboardingRepository(userId);

  await repository.replaceHabits(input);
};

