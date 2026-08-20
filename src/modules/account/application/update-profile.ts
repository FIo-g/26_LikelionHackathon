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
      const raw = input as { nickname?: unknown; timezone?: unknown };
      const parsed = accountProfileSchema.parse({ nickname: raw.nickname, timezone: raw.timezone });
      await repository.updateProfile(scope, parsed);
    },
  };
};
