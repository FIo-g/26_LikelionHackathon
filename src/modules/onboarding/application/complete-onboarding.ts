import { createOnboardingRepository } from "../infrastructure/prisma-onboarding-repository";
import type { ProfileInput } from "../domain/types";

export const completeOnboarding = async (
  userId: string,
  profile: ProfileInput,
): Promise<void> => {
  const repository = createOnboardingRepository(userId);

  await repository.complete(profile);
};

