import { parseConnectSchema } from "../domain/schemas";
import { createOnboardingRepository } from "../infrastructure/prisma-onboarding-repository";
import type { ConnectInput } from "../domain/types";

export const saveConnectStep = async (
  userId: string,
  input: ConnectInput,
): Promise<void> => {
  const normalized = parseConnectSchema(input);
  const repository = createOnboardingRepository(userId);

  await repository.saveConnect(normalized);
};

