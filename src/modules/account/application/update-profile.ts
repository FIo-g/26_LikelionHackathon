import type { UserScope } from "@/shared/domain/contracts";
import { accountProfileSchema } from "../domain/schemas";
import { createPrismaAccountRepository } from "../infrastructure/prisma-account-repository";
import type { AccountRepository } from "./ports";

export const createUpdateProfileService = (
  scope: UserScope,
  dependencies: Readonly<{ repository?: AccountRepository }> = {},
) => {
  const repository = dependencies.repository ?? createPrismaAccountRepository();
  return {
    update: async (input: unknown): Promise<void> => {
      const raw = input && typeof input === "object" && !Array.isArray(input)
        ? input as Record<string, unknown>
        : {};
      // Deliberately project known fields instead of accepting a client-supplied
      // profile identifier. The authenticated UserScope remains the only owner
      // selector in the repository.
      const parsed = accountProfileSchema.parse({
        nickname: raw.nickname,
        timezone: raw.timezone,
        age: raw.age,
        gender: raw.gender,
        heightCm: raw.heightCm,
        weightKg: raw.weightKg,
      });
      await repository.updateProfile(scope, parsed);
    },
  };
};
