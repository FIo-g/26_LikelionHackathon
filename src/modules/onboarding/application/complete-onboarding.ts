import { createOnboardingRepository } from "../infrastructure/prisma-onboarding-repository";

export const completeOnboarding = async (
  userId: string,
): Promise<void> => {
  const repository = createOnboardingRepository(userId);

  await repository.complete();
};
