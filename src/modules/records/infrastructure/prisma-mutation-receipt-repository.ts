import type { Clock, UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import type { MutationReceiptRepository, MutationReceiptCommand } from "@/modules/records/application/ports";

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

export const createMutationReceiptRepository = (
  db: TransactionClient,
  scope: UserScope,
  clock: Clock,
): MutationReceiptRepository => {
  const client = asAnyPrisma(db);

  return {
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

      try {
        await client.mutationReceipt.create({
          data: withPendingReceipt(scope, command, now),
        });
      } catch (error) {
        if (!isUniqueError(error)) {
          throw error;
        }

        const current = await client.mutationReceipt.findUnique({
          where: {
            userId_operation_idempotencyKey: {
              userId: scope.userId,
              operation: command.operation,
              idempotencyKey: command.idempotencyKey,
            },
          },
        }) as Record<string, unknown> | null;

        if (!current) {
          throw error;
        }

        if (current.requestHash !== command.requestHash) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }

        if (current.status === "completed") {
          return extractResponse(current) as T;
        }

        throw new Error("IDEMPOTENCY_IN_PROGRESS");
      }

      const response = await work();

      await client.mutationReceipt.update({
        where: {
          userId_operation_idempotencyKey: {
            userId: scope.userId,
            operation: command.operation,
            idempotencyKey: command.idempotencyKey,
          },
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
