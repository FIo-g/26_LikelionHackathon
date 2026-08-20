import type { Clock, UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import {
  MutationReceiptRaceError,
  type MutationReceiptRepository,
  type MutationReceiptCommand,
} from "@/modules/records/application/ports";

type AnyPrismaTx = TransactionClient & {
  mutationReceipt: {
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    update: (args: unknown) => Promise<Record<string, unknown>>;
  };
};

const asAnyPrisma = (db: TransactionClient): AnyPrismaTx => db as AnyPrismaTx;

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const isUniqueError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (error as { code?: string }).code === "P2002";
};

const withPendingReceipt = (
  scope: UserScope,
  command: MutationReceiptCommand,
  now: Date,
) => ({
  userId: scope.userId,
  operation: command.operation,
  idempotencyKey: command.idempotencyKey,
  requestHash: command.requestHash,
  status: "pending",
  resourceType: null,
  resourceId: null,
  responseJson: null,
  expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
});

const extractResponse = (stored: Record<string, unknown>): unknown => {
  if (stored.responseJson === undefined) {
    return null;
  }

  return stored.responseJson;
};

const receiptWhere = (scope: UserScope, command: MutationReceiptCommand) => ({
  userId_operation_idempotencyKey: {
    userId: scope.userId,
    operation: command.operation,
    idempotencyKey: command.idempotencyKey,
  },
});

const resolveStoredReceipt = <T>(
  current: Record<string, unknown> | null,
  command: MutationReceiptCommand,
): T => {
  if (!current) {
    throw new MutationReceiptRaceError();
  }
  if (current.requestHash !== command.requestHash) {
    throw new Error("IDEMPOTENCY_CONFLICT");
  }
  if (current.status !== "completed") {
    throw new Error("IDEMPOTENCY_IN_PROGRESS");
  }

  return extractResponse(current) as T;
};

export const createMutationReceiptRepository = (
  db: TransactionClient,
  scope: UserScope,
  clock: Clock,
): MutationReceiptRepository => {
  const client = asAnyPrisma(db);

  return {
    resolve: async <T>(command: MutationReceiptCommand): Promise<T> => {
      const current = await client.mutationReceipt.findUnique({
        where: receiptWhere(scope, command),
      }) as Record<string, unknown> | null;
      return resolveStoredReceipt<T>(current, command);
    },
    execute: async <T>(command: MutationReceiptCommand, work: () => Promise<T>): Promise<T> => {
      const now = clock.now();

      await client.mutationReceipt.deleteMany({
        where: {
          userId: scope.userId,
          operation: command.operation,
          idempotencyKey: command.idempotencyKey,
          expiresAt: {
            lte: now,
          },
        },
      });

      const existing = await client.mutationReceipt.findUnique({
        where: receiptWhere(scope, command),
      }) as Record<string, unknown> | null;
      if (existing) {
        return resolveStoredReceipt<T>(existing, command);
      }

      try {
        await client.mutationReceipt.create({
          data: withPendingReceipt(scope, command, now),
        });
      } catch (error) {
        if (!isUniqueError(error)) {
          throw error;
        }
        throw new MutationReceiptRaceError();
      }

      const response = await work();

      await client.mutationReceipt.update({
        where: {
          ...receiptWhere(scope, command),
        },
        data: {
          status: "completed",
          responseJson: response as Record<string, unknown>,
          expiresAt: new Date(clock.now().getTime() + IDEMPOTENCY_TTL_MS),
          resourceType: typeof response === "object" && response !== null
            ? (response as { recordType?: string; type?: string; typeName?: string }).recordType
              ?? (response as { recordType?: string; type?: string; typeName?: string }).type
              ?? (response as { recordType?: string; type?: string; typeName?: string }).typeName
              ?? null
            : null,
          resourceId: typeof response === "object" && response !== null
            ? (response as { recordId?: string }).recordId
              ?? (response as { id?: string }).id
              ?? null
            : null,
        },
      });

      return response;
    },
  };
};
