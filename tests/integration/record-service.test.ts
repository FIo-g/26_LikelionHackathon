import { describe, expect, it } from "vitest";

import { parseCreateRecordInput, parseUpdateRecordInput } from "@/modules/records/domain/schemas";
import { createRecordService } from "@/modules/records/application/record-service";
import type { UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";

type DailyLogRow = {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
};

type CaffeineRow = {
  id: string;
  userId: string;
  dailyLogId: string;
  brand: string;
  product: string;
  caffeineMg: number;
  consumedAt: Date;
  timezone: string;
};

type MealRow = {
  id: string;
  userId: string;
  dailyLogId: string;
  size: "small" | "medium" | "large";
  eatenAt: Date;
  notes: string | null;
  timezone: string;
};

type ExerciseRow = {
  id: string;
  userId: string;
  dailyLogId: string;
  exerciseType: string;
  intensity: "low" | "medium" | "high";
  startedAt: Date;
  endedAt: Date;
  averageHeartRate: number | null;
  timezone: string;
};

type WellnessRow = {
  id: string;
  userId: string;
  dailyLogId: string;
  localDate: string;
  fatigueLevel: number;
  stressLevel: number;
  timezone: string;
};

type RecordRevisionRow = {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  before: unknown;
  after: unknown;
  changedAt: Date;
};

type MutationReceiptRow = {
  id: string;
  userId: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  status: string;
  resourceType: string | null;
  resourceId: string | null;
  responseJson: unknown;
  expiresAt: Date;
};

type MockState = {
  dailyLogs: DailyLogRow[];
  caffeineEntries: CaffeineRow[];
  mealEntries: MealRow[];
  exerciseEntries: ExerciseRow[];
  wellnessEntries: WellnessRow[];
  recordRevisions: RecordRevisionRow[];
  mutationReceipts: MutationReceiptRow[];
};

type Fixtures = {
  state: MockState;
  getPrisma: () => { $transaction: <T>(callback: (tx: TransactionClient) => Promise<T>) => Promise<T> };
};

type DbHooks = {
  throwOnExerciseCreate?: boolean;
};

const createId = (() => {
  let index = 1;
  return () => `id-${index++}`;
})();

const cloneState = (state: MockState): MockState => ({
  dailyLogs: [...state.dailyLogs.map((row) => ({ ...row }))],
  caffeineEntries: [...state.caffeineEntries.map((row) => ({ ...row, consumedAt: new Date(row.consumedAt) }))],
  mealEntries: [...state.mealEntries.map((row) => ({ ...row, eatenAt: new Date(row.eatenAt) }))],
  exerciseEntries: [...state.exerciseEntries.map((row) => ({ ...row, startedAt: new Date(row.startedAt), endedAt: new Date(row.endedAt) }))],
  wellnessEntries: [...state.wellnessEntries.map((row) => ({ ...row }))],
  recordRevisions: [...state.recordRevisions.map((row) => ({
    ...row,
    before: row.before ? structuredClone(row.before) : row.before,
    after: row.after ? structuredClone(row.after) : row.after,
    changedAt: new Date(row.changedAt),
  }))],
  mutationReceipts: [...state.mutationReceipts.map((row) => ({
    ...row,
    responseJson: row.responseJson ? structuredClone(row.responseJson) : row.responseJson,
    expiresAt: new Date(row.expiresAt),
  }))],
});

const createMockPrisma = (hooks: DbHooks = {}): Fixtures => {
  const state: MockState = {
    dailyLogs: [],
    caffeineEntries: [],
    mealEntries: [],
    exerciseEntries: [],
    wellnessEntries: [],
    recordRevisions: [],
    mutationReceipts: [],
  };

  const clone = (): MockState => cloneState(state);

  const getOrCreateDailyLog = (userId: string, localDate: string, timezone: string): DailyLogRow => {
    const found = state.dailyLogs.find((row) => row.userId === userId && row.localDate === localDate && row.timezone === timezone);
    if (found) {
      return found;
    }

    const created = {
      id: createId(),
      userId,
      localDate,
      timezone,
    };
    state.dailyLogs.push(created);
    return created;
  };

  const getDailyLog = (dailyLogId: string): DailyLogRow | undefined => (
    state.dailyLogs.find((row) => row.id === dailyLogId)
  );

  const withTransaction = async <T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> => {
    const before = clone();
    try {
      const tx = {
        dailyLog: {
          upsert: async ({
            where,
          }: {
            where: { userId_localDate_timezone: { userId: string; localDate: string; timezone: string } };
          }): Promise<DailyLogRow> => {
            return getOrCreateDailyLog(where.userId_localDate_timezone.userId, where.userId_localDate_timezone.localDate, where.userId_localDate_timezone.timezone);
          },
        },
        caffeineEntry: {
          findFirst: async ({
            where,
            include,
          }: {
            where: { id: string; userId: string };
            include?: { dailyLog?: { select: { localDate: true } } };
          }) => {
            const found = state.caffeineEntries.find((row) => row.id === where.id && row.userId === where.userId);
            if (!found) {
              return null;
            }

            const dailyLog = getDailyLog(found.dailyLogId);
            return include?.dailyLog ? { ...found, dailyLog: { localDate: dailyLog?.localDate ?? "" } } : found;
          },
          create: async ({ data }: { data: Omit<CaffeineRow, "id"> }) => {
            const row = { ...data, id: createId() } as CaffeineRow;
            state.caffeineEntries.push(row);

            const dailyLog = getDailyLog(row.dailyLogId);
            return { ...row, dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined };
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<CaffeineRow>;
          }) => {
            const index = state.caffeineEntries.findIndex((row) => row.id === where.id);
            if (index < 0) {
              throw new Error("Not found");
            }

            state.caffeineEntries[index] = { ...state.caffeineEntries[index], ...data } as CaffeineRow;
            const dailyLog = getDailyLog(state.caffeineEntries[index].dailyLogId);
            return {
              ...state.caffeineEntries[index],
              dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined,
            };
          },
          delete: async ({ where }: { where: { id: string } }) => {
            const index = state.caffeineEntries.findIndex((row) => row.id === where.id);
            if (index >= 0) {
              state.caffeineEntries.splice(index, 1);
            }
          },
        },
        mealEntry: {
          findFirst: async ({
            where,
            include,
          }: {
            where: { id: string; userId: string };
            include?: { dailyLog?: { select: { localDate: true } } };
          }) => {
            const found = state.mealEntries.find((row) => row.id === where.id && row.userId === where.userId);
            if (!found) {
              return null;
            }

            const dailyLog = getDailyLog(found.dailyLogId);
            return include?.dailyLog ? { ...found, dailyLog: { localDate: dailyLog?.localDate ?? "" } } : found;
          },
          create: async ({ data }: { data: Omit<MealRow, "id"> }) => {
            const row = { ...data, id: createId() } as MealRow;
            state.mealEntries.push(row);
            const dailyLog = getDailyLog(row.dailyLogId);
            return { ...row, dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined };
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<MealRow>;
          }) => {
            const index = state.mealEntries.findIndex((row) => row.id === where.id);
            if (index < 0) {
              throw new Error("Not found");
            }
            state.mealEntries[index] = { ...state.mealEntries[index], ...data } as MealRow;
            const dailyLog = getDailyLog(state.mealEntries[index].dailyLogId);
            return {
              ...state.mealEntries[index],
              dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined,
            };
          },
          delete: async ({ where }: { where: { id: string } }) => {
            const index = state.mealEntries.findIndex((row) => row.id === where.id);
            if (index >= 0) {
              state.mealEntries.splice(index, 1);
            }
          },
        },
        exerciseEntry: {
          findFirst: async ({
            where,
            include,
          }: {
            where: { id: string; userId: string };
            include?: { dailyLog?: { select: { localDate: true } } };
          }) => {
            const found = state.exerciseEntries.find((row) => row.id === where.id && row.userId === where.userId);
            if (!found) {
              return null;
            }

            const dailyLog = getDailyLog(found.dailyLogId);
            return include?.dailyLog ? { ...found, dailyLog: { localDate: dailyLog?.localDate ?? "" } } : found;
          },
          create: async ({ data }: { data: Omit<ExerciseRow, "id"> }) => {
            if (hooks.throwOnExerciseCreate) {
              throw new Error("EXERCISE_CREATE_FAILED");
            }

            const row = { ...data, id: createId() } as ExerciseRow;
            state.exerciseEntries.push(row);
            const dailyLog = getDailyLog(row.dailyLogId);
            return { ...row, dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined };
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<ExerciseRow>;
          }) => {
            const index = state.exerciseEntries.findIndex((row) => row.id === where.id);
            if (index < 0) {
              throw new Error("Not found");
            }
            state.exerciseEntries[index] = { ...state.exerciseEntries[index], ...data } as ExerciseRow;
            const dailyLog = getDailyLog(state.exerciseEntries[index].dailyLogId);
            return {
              ...state.exerciseEntries[index],
              dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined,
            };
          },
          delete: async ({ where }: { where: { id: string } }) => {
            const index = state.exerciseEntries.findIndex((row) => row.id === where.id);
            if (index >= 0) {
              state.exerciseEntries.splice(index, 1);
            }
          },
        },
        wellnessEntry: {
          findFirst: async ({
            where,
            include,
          }: {
            where: { id: string; userId: string };
            include?: { dailyLog?: { select: { localDate: true } } };
          }) => {
            const found = state.wellnessEntries.find((row) => row.id === where.id && row.userId === where.userId);
            if (!found) {
              return null;
            }

            const dailyLog = getDailyLog(found.dailyLogId);
            return include?.dailyLog ? { ...found, dailyLog: { localDate: dailyLog?.localDate ?? "" } } : found;
          },
          create: async ({ data }: { data: Omit<WellnessRow, "id"> }) => {
            const row = { ...data, id: createId() } as WellnessRow;
            state.wellnessEntries.push(row);
            const dailyLog = getDailyLog(row.dailyLogId);
            return { ...row, dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined };
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<WellnessRow>;
          }) => {
            const index = state.wellnessEntries.findIndex((row) => row.id === where.id);
            if (index < 0) {
              throw new Error("Not found");
            }
            state.wellnessEntries[index] = { ...state.wellnessEntries[index], ...data } as WellnessRow;
            const dailyLog = getDailyLog(state.wellnessEntries[index].dailyLogId);
            return {
              ...state.wellnessEntries[index],
              dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined,
            };
          },
          delete: async ({ where }: { where: { id: string } }) => {
            const index = state.wellnessEntries.findIndex((row) => row.id === where.id);
            if (index >= 0) {
              state.wellnessEntries.splice(index, 1);
            }
          },
        },
        sleepSession: {
          findFirst: async () => null,
          create: async () => { throw new Error("Unsupported type for this test"); },
          update: async () => { throw new Error("Unsupported type for this test"); },
          delete: async () => undefined,
        },
        alcoholEntry: {
          findFirst: async () => null,
          create: async () => { throw new Error("Unsupported type for this test"); },
          update: async () => { throw new Error("Unsupported type for this test"); },
          delete: async () => undefined,
        },
        phoneUsageEntry: {
          findFirst: async () => null,
          create: async () => { throw new Error("Unsupported type for this test"); },
          update: async () => { throw new Error("Unsupported type for this test"); },
          delete: async () => undefined,
        },
        recordRevision: {
          create: async ({ data }: { data: Omit<RecordRevisionRow, "id"> }) => {
            state.recordRevisions.push({ id: createId(), ...data });
            return {};
          },
        },
        mutationReceipt: {
          deleteMany: async ({
            where,
          }: {
            where: { userId: string; operation: string; idempotencyKey: string; expiresAt: { lte: Date } };
          }) => {
            const remaining = state.mutationReceipts.length;
            state.mutationReceipts = state.mutationReceipts.filter((row) => (
              !(row.userId === where.userId && row.operation === where.operation && row.idempotencyKey === where.idempotencyKey && row.expiresAt <= where.expiresAt.lte)
            ));

            return { count: remaining - state.mutationReceipts.length };
          },
          create: async (args: { data: Omit<MutationReceiptRow, "id"> }) => {
            const exists = state.mutationReceipts.some((row) => (
              row.userId === args.data.userId
              && row.operation === args.data.operation
              && row.idempotencyKey === args.data.idempotencyKey
            ));
            if (exists) {
              throw { code: "P2002" };
            }

            state.mutationReceipts.push({ id: createId(), ...args.data });
            return {};
          },
          findUnique: async ({
            where,
          }: {
            where: { userId_operation_idempotencyKey: { userId: string; operation: string; idempotencyKey: string } };
          }) => {
            return state.mutationReceipts.find((row) => (
              row.userId === where.userId_operation_idempotencyKey.userId
              && row.operation === where.userId_operation_idempotencyKey.operation
              && row.idempotencyKey === where.userId_operation_idempotencyKey.idempotencyKey
            )) ?? null;
          },
          update: async ({
            where,
            data,
          }: {
            where: { userId_operation_idempotencyKey: { userId: string; operation: string; idempotencyKey: string } };
            data: Partial<MutationReceiptRow>;
          }) => {
            const found = state.mutationReceipts.find((row) => (
              row.userId === where.userId_operation_idempotencyKey.userId
              && row.operation === where.userId_operation_idempotencyKey.operation
              && row.idempotencyKey === where.userId_operation_idempotencyKey.idempotencyKey
            ));
            if (!found) {
              throw new Error("Receipt not found");
            }

            Object.assign(found, data);
            return found;
          },
        },
      };

      return await callback(tx as unknown as TransactionClient);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  };

  return {
    state,
    getPrisma: () => ({
      $transaction: withTransaction,
    }),
  };
};

const clock = { now: () => new Date("2026-08-20T00:00:00.000Z") };
const toScope = (userId: string): UserScope => ({
  userId,
  timezone: "Asia/Seoul",
});

const caffeineInput = parseCreateRecordInput(clock, {
  type: "caffeine",
  brand: "test",
  product: "americano",
  caffeineMg: 100,
  consumedAt: new Date("2026-08-19T07:00:00.000Z"),
  timezone: "Asia/Seoul",
});

const mealInput = parseCreateRecordInput(clock, {
  type: "meal",
  size: "small",
  eatenAt: new Date("2026-08-19T08:00:00.000Z"),
  notes: "snack",
  timezone: "Asia/Seoul",
});

const exerciseInput = parseCreateRecordInput(clock, {
  type: "exercise",
  exerciseType: "run",
  intensity: "medium",
  startedAt: new Date("2026-08-19T09:00:00.000Z"),
  endedAt: new Date("2026-08-19T10:00:00.000Z"),
  averageHeartRate: 120,
  timezone: "Asia/Seoul",
});

const wellnessInput = parseCreateRecordInput(clock, {
  type: "wellness",
  localDate: "2026-08-19",
  fatigueLevel: 2,
  stressLevel: 3,
  timezone: "Asia/Seoul",
});

describe("record service", () => {
  it("creates, updates, and deletes one caffeine record with one revision per phase", async () => {
    const fixtures = createMockPrisma();
    const service = createRecordService(toScope("alice"), {
      clock,
      getPrisma: fixtures.getPrisma,
    });

    const created = await service.create({
      idempotencyKey: "create-caffeine",
      input: caffeineInput,
    });

    const replayed = await service.create({
      idempotencyKey: "create-caffeine",
      input: caffeineInput,
    });

    expect(replayed.recordId).toBe(created.recordId);

    const updated = await service.update({
      idempotencyKey: "update-caffeine",
      recordId: created.recordId,
      input: parseUpdateRecordInput(clock, {
        ...caffeineInput,
        caffeineMg: 120,
      }),
    });

    const deleted = await service.delete({
      idempotencyKey: "delete-caffeine",
      recordId: created.recordId,
      recordType: created.recordType,
    });

    expect(updated.recordId).toBe(created.recordId);
    expect(deleted.recordId).toBe(created.recordId);
    expect(fixtures.state.caffeineEntries).toHaveLength(0);
    expect(fixtures.state.recordRevisions).toHaveLength(3);
    expect(fixtures.state.recordRevisions.map((row) => row.operation)).toEqual([
      "create",
      "update",
      "delete",
    ]);
    expect(fixtures.state.recordRevisions[0].before).toBeNull();
    expect(fixtures.state.recordRevisions[1].before).toMatchObject({
      schemaVersion: 1,
      record: {
        fields: {
          caffeineMg: 100,
        },
      },
    });
    expect(fixtures.state.recordRevisions[1].after).toMatchObject({
      schemaVersion: 1,
      record: {
        fields: {
          caffeineMg: 120,
        },
      },
    });
    expect(fixtures.state.recordRevisions[2].after).toBeNull();
    expect(fixtures.state.mutationReceipts).toHaveLength(3);
  });

  it("rolls back an entire save batch when one item fails", async () => {
    const fixtures = createMockPrisma({
      throwOnExerciseCreate: true,
    });
    const service = createRecordService(toScope("alice"), {
      clock,
      getPrisma: fixtures.getPrisma,
    });

    await expect(service.saveBatch({
      idempotencyKey: "batch-fail",
      items: [
        {
          clientKey: "meal-item",
          recordId: null,
          input: mealInput,
        },
        {
          clientKey: "exercise-item",
          recordId: null,
          input: exerciseInput,
        },
        {
          clientKey: "wellness-item",
          recordId: null,
          input: wellnessInput,
        },
      ],
    })).rejects.toThrow("EXERCISE_CREATE_FAILED");

    expect(fixtures.state.mealEntries).toHaveLength(0);
    expect(fixtures.state.exerciseEntries).toHaveLength(0);
    expect(fixtures.state.wellnessEntries).toHaveLength(0);
    expect(fixtures.state.recordRevisions).toHaveLength(0);
    expect(fixtures.state.mutationReceipts).toHaveLength(0);
  });

  it("validates cross-type and other-user deletes", async () => {
    const fixtures = createMockPrisma();
    const aliceService = createRecordService(toScope("alice"), {
      clock,
      getPrisma: fixtures.getPrisma,
    });
    const bobService = createRecordService(toScope("bob"), {
      clock,
      getPrisma: fixtures.getPrisma,
    });

    const savedMeal = await aliceService.saveBatch({
      idempotencyKey: "save-meal",
      items: [{ clientKey: "meal", recordId: null, input: mealInput }],
    });

    const mealId = savedMeal.records[0].recordId;

    await expect(
      aliceService.deleteBatch({
        idempotencyKey: "cross-type-delete",
        items: [{ recordId: mealId, recordType: "caffeine" }],
      }),
    ).rejects.toThrow("RECORD_NOT_FOUND");

    await expect(
      bobService.delete({
        idempotencyKey: "other-user-delete",
        recordId: mealId,
        recordType: "meal",
      }),
    ).rejects.toThrow("RECORD_NOT_FOUND");

    expect(fixtures.state.mealEntries).toHaveLength(1);
    expect(fixtures.state.recordRevisions).toHaveLength(1);
    expect(fixtures.state.mutationReceipts).toHaveLength(1);
  });

  it("recalculates rolling windows for both dates after a moved record", async () => {
    const fixtures = createMockPrisma();
    const service = createRecordService(toScope("alice"), {
      clock,
      getPrisma: fixtures.getPrisma,
    });
    const created = await service.create({
      idempotencyKey: "move-create",
      input: parseCreateRecordInput(clock, {
        ...caffeineInput,
        consumedAt: new Date("2026-08-10T07:00:00.000Z"),
      }),
    });

    const moved = await service.update({
      idempotencyKey: "move-update",
      recordId: created.recordId,
      input: parseUpdateRecordInput(clock, {
        ...caffeineInput,
        consumedAt: new Date("2026-08-19T07:00:00.000Z"),
      }),
    });

    expect(moved.affectedLocalDates).toEqual(expect.arrayContaining([
      "2026-08-10",
      "2026-08-19",
    ]));
  });

  it("conflicts when one idempotency key is reused with a different normalized body", async () => {
    const fixtures = createMockPrisma();
    const service = createRecordService(toScope("alice"), {
      clock,
      getPrisma: fixtures.getPrisma,
    });

    await service.create({
      idempotencyKey: "same-create-key",
      input: caffeineInput,
    });

    await expect(service.create({
      idempotencyKey: "same-create-key",
      input: parseCreateRecordInput(clock, {
        ...caffeineInput,
        consumedAt: new Date("2026-08-19T08:00:00.000Z"),
      }),
    })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
});
