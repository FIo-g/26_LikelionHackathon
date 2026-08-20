import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { UserScope } from "@/shared/domain/contracts";
import { createPrismaAccountRepository } from "../infrastructure/prisma-account-repository";
import type { AccountRepository, AccountViewModel } from "./ports";

export const getAccountViewModel = async (
  scope: UserScope,
  dependencies: Readonly<{ repository?: AccountRepository; getPrisma?: () => TransactionClient; identityEmail?: string | null }> = {},
): Promise<AccountViewModel> => {
  const repository = dependencies.repository ?? createPrismaAccountRepository((dependencies.getPrisma ?? getPrismaClient)());
  const data = await repository.getViewModelData(scope);
  return {
    ...data,
    identity: { email: dependencies.identityEmail ?? data.identity.email },
    dataManagement: { exportRequiresReauth: true, deleteRequiresReauth: true },
  };
};
