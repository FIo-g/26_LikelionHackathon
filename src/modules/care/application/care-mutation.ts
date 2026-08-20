import { createMutationReceiptRepository } from "@/modules/records/infrastructure/prisma-mutation-receipt-repository";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { systemClock } from "@/shared/time/system-clock";
import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import { createPrismaCareRepository } from "../infrastructure/prisma-care-repository";
import type { CareRepository } from "./ports";

export type CareMutationDependencies = Readonly<{
  clock?: Clock;
  repository?: CareRepository;
}>;

export const executeCareMutation = async <T>(
  scope: UserScope,
  operation: string,
  idempotencyKey: string,
  payload: unknown,
  dependencies: CareMutationDependencies,
  work: (repository: CareRepository, clock: Clock) => Promise<T>,
): Promise<T> => {
  const clock = dependencies.clock ?? systemClock;
  if (dependencies.repository) return work(dependencies.repository, clock);

  const prisma = getPrismaClient() as TransactionClient & {
    $transaction: <R>(callback: (transaction: TransactionClient) => Promise<R>) => Promise<R>;
  };
  return prisma.$transaction(async (transaction) => {
    const fixedNow = clock.now();
    const fixedClock: Clock = { now: () => fixedNow };
    const repository = createPrismaCareRepository(transaction, scope);
    const receipts = createMutationReceiptRepository(transaction, scope, fixedClock);
    return receipts.execute({ operation, idempotencyKey, requestHash: hashCanonicalJson({ operation, payload }) }, () => work(repository, fixedClock));
  });
};
