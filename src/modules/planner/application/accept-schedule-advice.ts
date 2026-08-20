import { z } from "zod";

import type { CreateMutationReceiptRepository } from "@/modules/records/application/ports";
import { createMutationReceiptRepository } from "@/modules/records/infrastructure/prisma-mutation-receipt-repository";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import { systemClock } from "@/shared/time/system-clock";
import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import { createPrismaPlannerRepository } from "../infrastructure/prisma-planner-repository";
import type { CreatePlannerRepository } from "./ports";

export type AcceptScheduleAdviceCommand = Readonly<{
  adviceId: string;
  idempotencyKey: string;
}>;

export type AcceptScheduleAdviceResult = Readonly<{
  planId: string;
  revisionId: string;
  changedDates: readonly string[];
}>;

export interface AcceptScheduleAdviceService {
  acceptScheduleAdvice(command: AcceptScheduleAdviceCommand): Promise<AcceptScheduleAdviceResult>;
}

type TransactionRunner = Readonly<{
  $transaction: <T>(callback: (transaction: TransactionClient) => Promise<T>) => Promise<T>;
}>;

const commandSchema = z.object({
  adviceId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(200),
}).strict();

const isUniqueError = (error: unknown): boolean => (
  typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
);

export const createAcceptScheduleAdviceService = (
  scope: UserScope,
  dependencies: Readonly<{
    clock?: Clock;
    getPrisma?: () => TransactionRunner;
    executeTransaction?: <T>(work: (transaction?: TransactionClient) => Promise<T>) => Promise<T>;
    createPlannerRepository?: CreatePlannerRepository;
    createMutationReceiptRepository?: CreateMutationReceiptRepository;
  }> = {},
): AcceptScheduleAdviceService => {
  const clock = dependencies.clock ?? systemClock;
  const getPrisma = dependencies.getPrisma ?? (() => getPrismaClient() as TransactionRunner);
  const plannerRepositoryFactory = dependencies.createPlannerRepository ?? createPrismaPlannerRepository;
  const receiptRepositoryFactory = dependencies.createMutationReceiptRepository ?? createMutationReceiptRepository;

  return {
    acceptScheduleAdvice: async (command) => {
      const parsed = commandSchema.parse(command);
      const fixedNow = clock.now();
      const fixedClock: Clock = { now: () => fixedNow };
      const requestHash = hashCanonicalJson({ operation: "planner.acceptScheduleAdvice", adviceId: parsed.adviceId });
      const executeTransaction = dependencies.executeTransaction
        ?? ((work) => getPrisma().$transaction((transaction) => work(transaction)));
      const accept = () => executeTransaction(async (transaction) => {
        const plannerRepository = plannerRepositoryFactory(transaction as TransactionClient, scope);
        const receipts = receiptRepositoryFactory(transaction as TransactionClient, scope, fixedClock);
        return receipts.execute({
          operation: "planner.acceptScheduleAdvice",
          idempotencyKey: parsed.idempotencyKey,
          requestHash,
        }, () => plannerRepository.acceptAdvice({
          adviceId: parsed.adviceId,
          effectiveLocalDate: wakeLocalDate(fixedNow, scope.timezone),
        }));
      });

      try {
        return await accept();
      } catch (error) {
        if (!isUniqueError(error)) throw error;
        return accept();
      }
    },
  };
};
