import { createOnboardingRepository } from "../infrastructure/prisma-onboarding-repository";
import type { ProfileInput } from "../domain/types";

/**
 * Persists the first Figma onboarding step without marking onboarding complete.
 * Completion happens only after the remaining owned steps are present.
 */
export const saveProfileStep = async (
  userId: string,
  input: ProfileInput,
): Promise<void> => {
  const repository = createOnboardingRepository(userId);

  await repository.saveProfile(input);
};
