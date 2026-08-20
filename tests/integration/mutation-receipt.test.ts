import { describe, expect, it, vi } from "vitest";

import { createMutationReceiptRepository } from "@/modules/records/infrastructure/prisma-mutation-receipt-repository";
import type { MutationReceiptCommand } from "@/modules/records/application/ports";

type MutationReceiptRow = {
  id: string;
  userId: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  status: string;
  responseJson: unknown;
  resourceType: string | null;
  resourceId: string | null;
  expiresAt: Date;
};

const createId = (() => {
  let sequence = 1;
  return () => `id-${sequence++}`;
})();

const createMockDb = () => {
  const rows: MutationReceiptRow[] = [];

  return {
    rows,
    db: {
      mutationReceipt: {
        deleteMany: async ({ where }: { where: { userId: string; operation: string; idempotencyKey: string; expiresAt: { lte: Date } } }) => {
          let removed = 0;
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            const row = rows[index];
            if (
              row.userId === where.userId
              && row.operation === where.operation
              && row.idempotencyKey === where.idempotencyKey
              && row.expiresAt.getTime() <= where.expiresAt.lte.getTime()
            ) {
              rows.splice(index, 1);
              removed += 1;
            }
          }
          return { count: removed };
        },
        create: async ({ data }: { data: Omit<MutationReceiptRow, "id"> }) => {
          const exists = rows.some((row) => (
            row.userId === data.userId
            && row.operation === data.operation
            && row.idempotencyKey === data.idempotencyKey
          ));
          if (exists) {
            throw { code: "P2002" };
          }

          const created: MutationReceiptRow = {
            ...data,
            id: createId(),
          };
          rows.push(created);
          return created;
        },
        findUnique: async ({
          where,
        }: { where: { userId_operation_idempotencyKey: { userId: string; operation: string; idempotencyKey: string } } }) => {
          const found = rows.find((row) => (
            row.userId === where.userId_operation_idempotencyKey.userId
            && row.operation === where.userId_operation_idempotencyKey.operation
            && row.idempotencyKey === where.userId_operation_idempotencyKey.idempotencyKey
          ));
          return found ?? null;
        },
        update: async ({
          where,
          data,
        }: {
          where: { userId_operation_idempotencyKey: { userId: string; operation: string; idempotencyKey: string } };
          data: Partial<Pick<MutationReceiptRow, "status" | "responseJson" | "resourceType" | "resourceId" | "expiresAt">>;
        }) => {
          const row = rows.find((current) => (
            current.userId === where.userId_operation_idempotencyKey.userId
            && current.operation === where.userId_operation_idempotencyKey.operation
            && current.idempotencyKey === where.userId_operation_idempotencyKey.idempotencyKey
          ));
          if (!row) {
            throw new Error("Receipt not found");
          }

          Object.assign(row, data);
          return row;
        },
      },
    },
  };
};

describe("mutation receipt repository", () => {
  it("reuses one completed response for the same request hash", async () => {
    const clockNow = new Date("2026-08-20T00:00:00.000Z");
    const clock = { now: () => clockNow };
    const fixture = createMockDb();
    const receipts = createMutationReceiptRepository(fixture.db as never, { userId: "u-1", timezone: "Asia/Seoul" }, clock);
    const command: MutationReceiptCommand = {
      operation: "record.create",
      idempotencyKey: "same-key",
      requestHash: "hash-1",
    };

    const work = vi.fn(async () => ({ id: "created-1" }));

    const first = await receipts.execute(command, work);
    const second = await receipts.execute(command, work);

    expect(first).toEqual({ id: "created-1" });
    expect(second).toEqual({ id: "created-1" });
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("rejects same key with different request hash", async () => {
    const clockNow = new Date("2026-08-20T00:00:00.000Z");
    const clock = { now: () => clockNow };
    const fixture = createMockDb();
    const receipts = createMutationReceiptRepository(fixture.db as never, { userId: "u-1", timezone: "Asia/Seoul" }, clock);
    const first: MutationReceiptCommand = {
      operation: "record.update",
      idempotencyKey: "same-key",
      requestHash: "hash-1",
    };
    const second: MutationReceiptCommand = {
      ...first,
      requestHash: "hash-2",
    };

    await receipts.execute(first, async () => ({ ok: true }));

    await expect(receipts.execute(second, async () => ({ ok: false }))).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("blocks concurrent mutations with a pending receipt", async () => {
    const clockNow = new Date("2026-08-20T00:00:00.000Z");
    const clock = { now: () => clockNow };
    const fixture = createMockDb();
    const receipts = createMutationReceiptRepository(fixture.db as never, { userId: "u-1", timezone: "Asia/Seoul" }, clock);

    const command: MutationReceiptCommand = {
      operation: "record.create",
      idempotencyKey: "parallel-key",
      requestHash: "hash-parallel",
    };

    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const firstWork = vi.fn(async () => {
      await gate;
      return { first: true };
    });

    const first = receipts.execute(command, firstWork);

    await Promise.resolve();

    const second = receipts.execute(command, async () => ({ second: true }));
    await expect(second).rejects.toThrow("IDEMPOTENCY_IN_PROGRESS");
    expect(firstWork).toHaveBeenCalledTimes(1);

    if (release) {
      release();
    }

    await first;
  });

  it("allows new mutation after expired receipt window", async () => {
    const now = new Date("2026-08-20T00:00:00.000Z");
    const clock = { now: () => now };
    const fixture = createMockDb();
    const receipts = createMutationReceiptRepository(fixture.db as never, { userId: "u-1", timezone: "Asia/Seoul" }, clock);

    const command: MutationReceiptCommand = {
      operation: "record.create",
      idempotencyKey: "expire-key",
      requestHash: "hash-expire",
    };

    const first = await receipts.execute(command, async () => ({ step: 1 }));
    expect(first).toEqual({ step: 1 });

    now.setTime(now.getTime() + 25 * 60 * 60 * 1000);
    const second = await receipts.execute(command, async () => ({ step: 2 }));
    expect(second).toEqual({ step: 2 });
  });
});
