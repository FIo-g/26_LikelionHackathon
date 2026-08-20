import { beforeEach, describe, expect, it } from "vitest";

import { parseCreateRecordInput } from "@/modules/records/domain/schemas";
import { createRecordRepository } from "@/modules/records/infrastructure/prisma-record-repository";

type DailyLogRow = {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
};

type CaffeineRow = {
  id: string;
  userId: string;
  brand: string;
  product: string;
  caffeineMg: number;
  consumedAt: Date;
  timezone: string;
  dailyLogId: string;
};

type MockDbState = {
  dailyLogs: DailyLogRow[];
  caffeineEntries: CaffeineRow[];
  recordRevisions: {
    input: unknown;
  }[];
};

const createIdGenerator = () => {
  let sequence = 1;
  return () => `id-${sequence++}`;
};

const createMockDb = () => {
  const state: MockDbState = {
    dailyLogs: [],
    caffeineEntries: [],
    recordRevisions: [],
  };

  const createId = createIdGenerator();

  const upsertDailyLog = async ({
    userId,
    localDate,
    timezone,
  }: {
    userId: string;
    localDate: string;
    timezone: string;
  }) => {
    const found = state.dailyLogs.find((row) => (
      row.userId === userId && row.localDate === localDate && row.timezone === timezone
    ));
    if (found) {
      return found;
    }

    const row = {
      id: createId(),
      userId,
      localDate,
      timezone,
    };
    state.dailyLogs.push(row);
    return row;
  };

  return {
    state,
    db: {
      dailyLog: {
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { userId_localDate_timezone: { userId: string; localDate: string; timezone: string } };
          create: DailyLogRow;
          update: Record<string, unknown>;
        }) => {
          const target = await upsertDailyLog(where.userId_localDate_timezone);
          if (update.localDate !== undefined || update.timezone !== undefined) {
            target.localDate = String(where.userId_localDate_timezone.localDate);
            target.timezone = String(where.userId_localDate_timezone.timezone);
          }
          return target;
        },
      },
      caffeineEntry: {
        findFirst: async ({
          where,
          include,
        }: { where: { id: string; userId: string }; include?: { dailyLog?: { select: { localDate: true } } } }) => {
          const row = state.caffeineEntries.find((item) => (
            item.id === where.id && item.userId === where.userId
          ));
          if (!row) {
            return null;
          }

          const dailyLog = state.dailyLogs.find((item) => item.id === row.dailyLogId);

          return {
            ...row,
            dailyLog: include?.dailyLog
              ? {
                localDate: dailyLog?.localDate ?? "",
              }
              : undefined,
          };
        },
        create: async ({ data }: { data: Omit<CaffeineRow, "id"> }) => {
          const row = { ...data, id: createId() };
          state.caffeineEntries.push(row);
          const dailyLog = state.dailyLogs.find((item) => item.id === row.dailyLogId);
          return {
            ...row,
            dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined,
          };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<CaffeineRow> }) => {
          const index = state.caffeineEntries.findIndex((item) => item.id === where.id);
          if (index < 0) {
            throw new Error("Not found");
          }

          state.caffeineEntries[index] = {
            ...state.caffeineEntries[index],
            ...data,
          };

          const dailyLog = state.dailyLogs.find((item) => item.id === state.caffeineEntries[index].dailyLogId);
          return {
            ...state.caffeineEntries[index],
            dailyLog: dailyLog ? { localDate: dailyLog.localDate } : undefined,
          };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const index = state.caffeineEntries.findIndex((item) => item.id === where.id);
          if (index >= 0) {
            state.caffeineEntries.splice(index, 1);
          }
        },
      },
      sleepSession: {
        findFirst: async () => null,
        create: async () => ({ id: "", userId: "", sleepDate: "", startedAt: new Date(), endedAt: new Date(), morningFatigue: 1, timezone: "", dailyLog: null }),
        update: async () => { throw new Error("Unsupported test operation"); },
        delete: async () => undefined,
      },
      alcoholEntry: {
        findFirst: async () => null,
        create: async () => ({
          id: "",
          userId: "",
          alcoholType: "",
          servings: 0,
          consumedAt: new Date(),
          timezone: "",
          dailyLog: null,
        }),
        update: async () => ({
          id: "",
          userId: "",
          alcoholType: "",
          servings: 0,
          consumedAt: new Date(),
          timezone: "",
          dailyLog: null,
        }),
        delete: async () => undefined,
      },
      mealEntry: {
        findFirst: async () => null,
        create: async () => ({
          id: "",
          userId: "",
          size: "small",
          eatenAt: new Date(),
          notes: null,
          timezone: "",
          dailyLog: null,
        }),
        update: async () => ({
          id: "",
          userId: "",
          size: "small",
          eatenAt: new Date(),
          notes: null,
          timezone: "",
          dailyLog: null,
        }),
        delete: async () => undefined,
      },
      exerciseEntry: {
        findFirst: async () => null,
        create: async () => ({
          id: "",
          userId: "",
          exerciseType: "",
          intensity: "low",
          startedAt: new Date(),
          endedAt: new Date(),
          averageHeartRate: null,
          timezone: "",
          dailyLog: null,
        }),
        update: async () => ({
          id: "",
          userId: "",
          exerciseType: "",
          intensity: "low",
          startedAt: new Date(),
          endedAt: new Date(),
          averageHeartRate: null,
          timezone: "",
          dailyLog: null,
        }),
        delete: async () => undefined,
      },
      phoneUsageEntry: {
        findFirst: async () => null,
        create: async () => ({
          id: "",
          userId: "",
          localDate: "",
          lastUseAt: new Date(),
          durationMinutes: 0,
          timezone: "",
        }),
        update: async () => ({
          id: "",
          userId: "",
          localDate: "",
          lastUseAt: new Date(),
          durationMinutes: 0,
          timezone: "",
        }),
        delete: async () => undefined,
      },
      wellnessEntry: {
        findFirst: async () => null,
        create: async () => ({
          id: "",
          userId: "",
          localDate: "",
          fatigueLevel: 1,
          stressLevel: 1,
          timezone: "",
        }),
        update: async () => ({
          id: "",
          userId: "",
          localDate: "",
          fatigueLevel: 1,
          stressLevel: 1,
          timezone: "",
        }),
        delete: async () => undefined,
      },
      recordRevision: {
        create: async ({ data }: { data: unknown }) => {
          state.recordRevisions.push({ input: data });
          return {};
        },
      },
    },
  };
};

const createScope = (userId: string) => ({
  userId,
  timezone: "Asia/Seoul",
});

const clock = { now: () => new Date("2026-08-20T00:00:00.000Z") };

const caffeineFixture = parseCreateRecordInput(clock, {
  type: "caffeine",
  brand: "test",
  product: "americano",
  caffeineMg: 100,
  consumedAt: new Date("2026-08-19T07:00:00.000Z"),
  timezone: "Asia/Seoul",
});

describe("record repository", () => {
  let fixture: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    fixture = createMockDb();
  });

  it("treats another user's record id as not found", async () => {
    const alice = createRecordRepository(fixture.db as never, createScope("alice"));
    const bob = createRecordRepository(fixture.db as never, createScope("bob"));

    const created = await alice.create("caffeine", caffeineFixture);

    await expect(
      bob.update("caffeine", created.id, {
        ...caffeineFixture,
        caffeineMg: 80,
      }),
    ).rejects.toThrow("RECORD_NOT_FOUND");

    const checked = await alice.findById("caffeine", created.id);
    expect(checked?.caffeineMg).toBe(caffeineFixture.caffeineMg);
  });

  it("reuses one daily log for same user and localDate", async () => {
    const alice = createRecordRepository(fixture.db as never, createScope("alice"));

    const first = await alice.create("caffeine", caffeineFixture);
    const second = await alice.create("caffeine", {
      ...caffeineFixture,
      product: "latte",
      consumedAt: new Date("2026-08-19T09:00:00.000Z"),
    });

    expect(first.userId).toBe("alice");
    expect(second.userId).toBe("alice");
    expect(fixture.state.dailyLogs).toHaveLength(1);
    expect(fixture.state.dailyLogs[0].localDate).toBe("2026-08-19");
    expect(fixture.state.caffeineEntries).toHaveLength(2);
  });

  it("updates and deletes by owner only", async () => {
    const alice = createRecordRepository(fixture.db as never, createScope("alice"));
    const bob = createRecordRepository(fixture.db as never, createScope("bob"));

    const created = await alice.create("caffeine", caffeineFixture);
    const updated = await alice.update("caffeine", created.id, {
      ...caffeineFixture,
      caffeineMg: 80,
    });

    expect(updated?.caffeineMg).toBe(80);

    await expect(
      bob.delete("caffeine", created.id),
    ).rejects.toThrow("RECORD_NOT_FOUND");

    await alice.delete("caffeine", created.id);
    await expect(alice.findById("caffeine", created.id)).resolves.toBeNull();
  });
});
