import { beforeEach, describe, expect, it } from "vitest";

import { parseCreateRecordInput } from "@/modules/records/domain/schemas";
import type { CreateRecordInput, RecordEntity } from "@/modules/records/domain/types";
import { createRecordRepository, serializeRecordPayload } from "@/modules/records/infrastructure/prisma-record-repository";

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

type AlcoholRow = {
  id: string;
  userId: string;
  alcoholType: string;
  servings: number;
  measurementUnit: string | null;
  consumedAt: Date;
  timezone: string;
  dailyLogId: string;
};

type MockDbState = {
  dailyLogs: DailyLogRow[];
  caffeineEntries: CaffeineRow[];
  alcoholEntries: AlcoholRow[];
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
    alcoholEntries: [],
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
        create: async ({
          data,
          include,
        }: { data: Omit<CaffeineRow, "id">; include?: { dailyLog?: { select: { localDate: true } } } }) => {
          const row = { ...data, id: createId() };
          state.caffeineEntries.push(row);
          const dailyLog = state.dailyLogs.find((item) => item.id === row.dailyLogId);
          return {
            ...row,
            dailyLog: include?.dailyLog && dailyLog ? { localDate: dailyLog.localDate } : undefined,
          };
        },
        update: async ({
          where,
          data,
          include,
        }: { where: { id: string }; data: Partial<CaffeineRow>; include?: { dailyLog?: { select: { localDate: true } } } }) => {
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
            dailyLog: include?.dailyLog && dailyLog ? { localDate: dailyLog.localDate } : undefined,
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
        findFirst: async ({
          where,
          include,
        }: { where: { id: string; userId: string }; include?: { dailyLog?: { select: { localDate: true } } } }) => {
          const row = state.alcoholEntries.find((item) => (
            item.id === where.id && item.userId === where.userId
          ));
          if (!row) {
            return null;
          }

          const dailyLog = state.dailyLogs.find((item) => item.id === row.dailyLogId);
          return {
            ...row,
            dailyLog: include?.dailyLog && dailyLog ? { localDate: dailyLog.localDate } : undefined,
          };
        },
        create: async ({
          data,
          include,
        }: { data: Omit<AlcoholRow, "id">; include?: { dailyLog?: { select: { localDate: true } } } }) => {
          const row = { ...data, id: createId() };
          state.alcoholEntries.push(row);
          const dailyLog = state.dailyLogs.find((item) => item.id === row.dailyLogId);
          return {
            ...row,
            dailyLog: include?.dailyLog && dailyLog ? { localDate: dailyLog.localDate } : undefined,
          };
        },
        update: async ({
          where,
          data,
          include,
        }: { where: { id: string }; data: Partial<AlcoholRow>; include?: { dailyLog?: { select: { localDate: true } } } }) => {
          const index = state.alcoholEntries.findIndex((item) => item.id === where.id);
          if (index < 0) {
            throw new Error("Not found");
          }

          state.alcoholEntries[index] = {
            ...state.alcoholEntries[index],
            ...data,
          };
          const row = state.alcoholEntries[index];
          const dailyLog = state.dailyLogs.find((item) => item.id === row.dailyLogId);
          return {
            ...row,
            dailyLog: include?.dailyLog && dailyLog ? { localDate: dailyLog.localDate } : undefined,
          };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const index = state.alcoholEntries.findIndex((item) => item.id === where.id);
          if (index >= 0) {
            state.alcoholEntries.splice(index, 1);
          }
        },
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

const createCaffeineFixture = (): Extract<CreateRecordInput, { type: "caffeine" }> => {
  const input = parseCreateRecordInput(clock, {
    type: "caffeine",
    brand: "test",
    product: "americano",
    caffeineMg: 100,
    consumedAt: new Date("2026-08-19T07:00:00.000Z"),
    timezone: "Asia/Seoul",
  });

  if (input.type !== "caffeine") {
    throw new Error("Expected caffeine fixture");
  }

  return input;
};

const caffeineFixture = createCaffeineFixture();

const createAlcoholFixture = (): Extract<CreateRecordInput, { type: "alcohol" }> => {
  const input = parseCreateRecordInput(clock, {
    type: "alcohol",
    alcoholType: "맥주",
    servings: 1,
    measurementUnit: "can",
    consumedAt: new Date("2026-08-19T07:00:00.000Z"),
    timezone: "Asia/Seoul",
  });

  if (input.type !== "alcohol") {
    throw new Error("Expected alcohol fixture");
  }

  return input;
};

const alcoholFixture = createAlcoholFixture();

const requireCaffeineRecord = (
  record: RecordEntity | null,
): Extract<RecordEntity, { type: "caffeine" }> => {
  if (record?.type !== "caffeine") {
    throw new Error("Expected caffeine record");
  }

  return record;
};

const requireAlcoholRecord = (
  record: RecordEntity | null,
): Extract<RecordEntity, { type: "alcohol" }> => {
  if (record?.type !== "alcohol") {
    throw new Error("Expected alcohol record");
  }

  return record;
};

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
    expect(requireCaffeineRecord(checked).caffeineMg).toBe(caffeineFixture.caffeineMg);
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
    expect(first.localDate).toBe("2026-08-19");
    expect(second.localDate).toBe("2026-08-19");
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

    expect(requireCaffeineRecord(updated).caffeineMg).toBe(80);

    await expect(
      bob.delete("caffeine", created.id),
    ).rejects.toThrow("RECORD_NOT_FOUND");

    await alice.delete("caffeine", created.id);
    await expect(alice.findById("caffeine", created.id)).resolves.toBeNull();
  });

  it("persists selected alcohol units, serializes revisions, and keeps legacy units null", async () => {
    const alice = createRecordRepository(fixture.db as never, createScope("alice"));

    const created = requireAlcoholRecord(await alice.create("alcohol", alcoholFixture));
    expect(created.measurementUnit).toBe("can");
    expect(fixture.state.alcoholEntries[0]).toMatchObject({ measurementUnit: "can" });

    const updated = requireAlcoholRecord(await alice.update("alcohol", created.id, {
      ...alcoholFixture,
      measurementUnit: "bottle",
    }));
    expect(updated.measurementUnit).toBe("bottle");
    expect(serializeRecordPayload(updated).record.fields).toMatchObject({ measurementUnit: "bottle" });

    fixture.state.alcoholEntries.push({
      id: "legacy-alcohol",
      userId: "alice",
      dailyLogId: fixture.state.dailyLogs[0]?.id ?? "missing-log",
      alcoholType: "맥주",
      servings: 1,
      measurementUnit: null,
      consumedAt: alcoholFixture.consumedAt,
      timezone: "Asia/Seoul",
    });
    const legacy = requireAlcoholRecord(await alice.findById("alcohol", "legacy-alcohol"));
    expect(legacy.measurementUnit).toBeNull();
    expect(serializeRecordPayload(legacy).record.fields).toMatchObject({ measurementUnit: null });
  });

  it("rejects an update input whose discriminator does not match the requested record type", async () => {
    const alice = createRecordRepository(fixture.db as never, createScope("alice"));
    const created = await alice.create("caffeine", caffeineFixture);

    await expect(alice.update("caffeine", created.id, {
      type: "sleep",
      startedAt: new Date("2026-08-19T06:00:00.000Z"),
      endedAt: new Date("2026-08-19T07:00:00.000Z"),
      morningFatigue: 3,
      timezone: "Asia/Seoul",
    })).rejects.toThrow("INVALID_RECORD_TYPE");

    await expect(alice.findById("caffeine", created.id)).resolves.toMatchObject({
      type: "caffeine",
      caffeineMg: 100,
    });
  });
});
