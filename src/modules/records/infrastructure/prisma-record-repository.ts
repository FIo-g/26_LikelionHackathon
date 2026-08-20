import type { VersionedPayload, UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import { wakeLocalDate } from "@/shared/time/local-date";
import type { RecordRepository } from "@/modules/records/application/ports";
import type { CreateRecordInput, RecordType, SerializedRecord, UpdateRecordInput, RecordEntity } from "@/modules/records/domain/types";

type DbRecordPayload = Record<string, unknown>;
type TxDb = TransactionClient & {
  dailyLog: {
    upsert: (args: unknown) => Promise<DbRecordPayload>;
  };
  sleepSession: {
    findFirst: (args: unknown) => Promise<DbRecordPayload | null>;
    create: (args: unknown) => Promise<DbRecordPayload>;
    update: (args: unknown) => Promise<DbRecordPayload>;
    delete: (args: unknown) => Promise<unknown>;
  };
  caffeineEntry: {
    findFirst: (args: unknown) => Promise<DbRecordPayload | null>;
    create: (args: unknown) => Promise<DbRecordPayload>;
    update: (args: unknown) => Promise<DbRecordPayload>;
    delete: (args: unknown) => Promise<unknown>;
  };
  alcoholEntry: {
    findFirst: (args: unknown) => Promise<DbRecordPayload | null>;
    create: (args: unknown) => Promise<DbRecordPayload>;
    update: (args: unknown) => Promise<DbRecordPayload>;
    delete: (args: unknown) => Promise<unknown>;
  };
  mealEntry: {
    findFirst: (args: unknown) => Promise<DbRecordPayload | null>;
    create: (args: unknown) => Promise<DbRecordPayload>;
    update: (args: unknown) => Promise<DbRecordPayload>;
    delete: (args: unknown) => Promise<unknown>;
  };
  exerciseEntry: {
    findFirst: (args: unknown) => Promise<DbRecordPayload | null>;
    create: (args: unknown) => Promise<DbRecordPayload>;
    update: (args: unknown) => Promise<DbRecordPayload>;
    delete: (args: unknown) => Promise<unknown>;
  };
  phoneUsageEntry: {
    findFirst: (args: unknown) => Promise<DbRecordPayload | null>;
    create: (args: unknown) => Promise<DbRecordPayload>;
    update: (args: unknown) => Promise<DbRecordPayload>;
    delete: (args: unknown) => Promise<unknown>;
  };
  wellnessEntry: {
    findFirst: (args: unknown) => Promise<DbRecordPayload | null>;
    create: (args: unknown) => Promise<DbRecordPayload>;
    update: (args: unknown) => Promise<DbRecordPayload>;
    delete: (args: unknown) => Promise<unknown>;
  };
  recordRevision: {
    create: (args: unknown) => Promise<unknown>;
  };
};

const toStringValue = (value: unknown): string => String(value);
const toDateValue = (value: unknown): Date => value instanceof Date ? value : new Date(String(value));
const asTx = (db: TransactionClient): TxDb => db as TxDb;

const recordTypeValues = [
  "sleep",
  "caffeine",
  "alcohol",
  "meal",
  "exercise",
  "phone-usage",
  "wellness",
] as const satisfies readonly RecordType[];

const isRecordType = (value: string): value is RecordType => (
  (recordTypeValues as readonly string[]).includes(value)
);

const deriveLocalDate = (input: CreateRecordInput | UpdateRecordInput): string => {
  switch (input.type) {
    case "sleep": {
      return wakeLocalDate(input.endedAt, input.timezone);
    }
    case "caffeine":
    case "alcohol": {
      return wakeLocalDate(input.consumedAt, input.timezone);
    }
    case "meal": {
      return wakeLocalDate(input.eatenAt, input.timezone);
    }
    case "exercise": {
      return wakeLocalDate(input.startedAt, input.timezone);
    }
    case "phone-usage": {
      return wakeLocalDate(input.lastUseAt, input.timezone);
    }
    case "wellness": {
      return input.localDate;
    }
    default: {
      return wakeLocalDate(new Date(), "UTC");
    }
  }
};

const localDateFromRow = (
  row: DbRecordPayload,
  type: RecordType,
): string => {
  switch (type) {
    case "sleep":
      return toStringValue(row.sleepDate);
    case "phone-usage":
    case "wellness":
      return toStringValue(row.localDate);
    default: {
      const dailyLog = row.dailyLog as { localDate?: unknown } | undefined | null;
      if (dailyLog?.localDate === undefined) {
        return "";
      }

      return toStringValue(dailyLog.localDate);
    }
  }
};

const mapToRecordEntity = (type: RecordType, row: DbRecordPayload): RecordEntity => {
  const userId = toStringValue(row.userId);
  const localDate = localDateFromRow(row, type);

  switch (type) {
    case "sleep":
      return {
        id: toStringValue(row.id),
        userId,
        localDate,
        type: "sleep",
        startedAt: toDateValue(row.startedAt),
        endedAt: toDateValue(row.endedAt),
        morningFatigue: Number(row.morningFatigue),
        timezone: toStringValue(row.timezone),
      };
    case "caffeine":
      return {
        id: toStringValue(row.id),
        userId,
        localDate,
        type: "caffeine",
        brand: toStringValue(row.brand),
        product: toStringValue(row.product),
        caffeineMg: Number(row.caffeineMg),
        consumedAt: toDateValue(row.consumedAt),
        timezone: toStringValue(row.timezone),
      };
    case "alcohol":
      return {
        id: toStringValue(row.id),
        userId,
        localDate,
        type: "alcohol",
        alcoholType: toStringValue(row.alcoholType),
        servings: Number(row.servings),
        consumedAt: toDateValue(row.consumedAt),
        timezone: toStringValue(row.timezone),
      };
    case "meal":
      return {
        id: toStringValue(row.id),
        userId,
        localDate,
        type: "meal",
        size: toStringValue(row.size) as "small" | "medium" | "large",
        eatenAt: toDateValue(row.eatenAt),
        notes: row.notes === null ? null : toStringValue(row.notes),
        timezone: toStringValue(row.timezone),
      };
    case "exercise":
      return {
        id: toStringValue(row.id),
        userId,
        localDate,
        type: "exercise",
        exerciseType: toStringValue(row.exerciseType),
        intensity: toStringValue(row.intensity) as "low" | "medium" | "high",
        startedAt: toDateValue(row.startedAt),
        endedAt: toDateValue(row.endedAt),
        averageHeartRate: row.averageHeartRate === null ? null : Number(row.averageHeartRate),
        timezone: toStringValue(row.timezone),
      };
    case "phone-usage":
      return {
        id: toStringValue(row.id),
        userId,
        localDate,
        type: "phone-usage",
        lastUseAt: toDateValue(row.lastUseAt),
        durationMinutes: Number(row.durationMinutes),
        timezone: toStringValue(row.timezone),
      };
    case "wellness":
      return {
        id: toStringValue(row.id),
        userId,
        localDate,
        type: "wellness",
        fatigueLevel: Number(row.fatigueLevel),
        stressLevel: Number(row.stressLevel),
        timezone: toStringValue(row.timezone),
      };
    default:
      throw new Error("Unsupported record type");
  }
};

const serializeDateFields = (record: RecordEntity): SerializedRecord => {
  switch (record.type) {
    case "sleep":
      return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        localDate: record.localDate,
        fields: {
          type: record.type,
          startedAt: record.startedAt.toISOString(),
          endedAt: record.endedAt.toISOString(),
          morningFatigue: record.morningFatigue,
          timezone: record.timezone,
        },
      };
    case "caffeine":
      return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        localDate: record.localDate,
        fields: {
          type: record.type,
          brand: record.brand,
          product: record.product,
          caffeineMg: record.caffeineMg,
          consumedAt: record.consumedAt.toISOString(),
          timezone: record.timezone,
        },
      };
    case "alcohol":
      return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        localDate: record.localDate,
        fields: {
          type: record.type,
          alcoholType: record.alcoholType,
          servings: record.servings,
          consumedAt: record.consumedAt.toISOString(),
          timezone: record.timezone,
        },
      };
    case "meal":
      return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        localDate: record.localDate,
        fields: {
          type: record.type,
          size: record.size,
          eatenAt: record.eatenAt.toISOString(),
          notes: record.notes,
          timezone: record.timezone,
        },
      };
    case "exercise":
      return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        localDate: record.localDate,
        fields: {
          type: record.type,
          exerciseType: record.exerciseType,
          intensity: record.intensity,
          startedAt: record.startedAt.toISOString(),
          endedAt: record.endedAt.toISOString(),
          averageHeartRate: record.averageHeartRate,
          timezone: record.timezone,
        },
      };
    case "phone-usage":
      return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        localDate: record.localDate,
        fields: {
          type: record.type,
          lastUseAt: record.lastUseAt.toISOString(),
          durationMinutes: record.durationMinutes,
          timezone: record.timezone,
        },
      };
    case "wellness":
      return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        localDate: record.localDate,
        fields: {
          type: record.type,
          fatigueLevel: record.fatigueLevel,
          stressLevel: record.stressLevel,
          timezone: record.timezone,
        },
      };
  }
};

export const serializeRecordPayload = (
  record: RecordEntity,
): VersionedPayload<{ record: SerializedRecord }> => ({
  schemaVersion: 1,
  record: serializeDateFields(record),
});

const resolveDailyLogId = async (
  db: TxDb,
  scope: UserScope,
  localDate: string,
  timezone: string,
): Promise<string> => {
  const dailyLog = await db.dailyLog.upsert({
    where: {
      userId_localDate_timezone: {
        userId: scope.userId,
        localDate,
        timezone,
      },
    },
    create: {
      userId: scope.userId,
      localDate,
      timezone,
    },
    update: {
      localDate,
      timezone,
    },
  });

  return toStringValue(dailyLog.id);
};

const readByType = async (
  db: TxDb,
  scope: UserScope,
  type: RecordType,
  id: string,
): Promise<RecordEntity | null> => {
  switch (type) {
    case "sleep": {
      const row = await db.sleepSession.findFirst({
        where: {
          id,
          userId: scope.userId,
        },
      });
      if (!row) {
        return null;
      }
      return mapToRecordEntity("sleep", row);
    }
    case "caffeine": {
      const row = await db.caffeineEntry.findFirst({
        where: { id, userId: scope.userId },
        include: { dailyLog: { select: { localDate: true } } },
      });
      if (!row) {
        return null;
      }
      return mapToRecordEntity("caffeine", row);
    }
    case "alcohol": {
      const row = await db.alcoholEntry.findFirst({
        where: { id, userId: scope.userId },
        include: { dailyLog: { select: { localDate: true } } },
      });
      if (!row) {
        return null;
      }
      return mapToRecordEntity("alcohol", row);
    }
    case "meal": {
      const row = await db.mealEntry.findFirst({
        where: { id, userId: scope.userId },
        include: { dailyLog: { select: { localDate: true } } },
      });
      if (!row) {
        return null;
      }
      return mapToRecordEntity("meal", row);
    }
    case "exercise": {
      const row = await db.exerciseEntry.findFirst({
        where: { id, userId: scope.userId },
        include: { dailyLog: { select: { localDate: true } } },
      });
      if (!row) {
        return null;
      }
      return mapToRecordEntity("exercise", row);
    }
    case "phone-usage": {
      const row = await db.phoneUsageEntry.findFirst({
        where: {
          id,
          userId: scope.userId,
        },
      });
      if (!row) {
        return null;
      }
      return mapToRecordEntity("phone-usage", row);
    }
    case "wellness": {
      const row = await db.wellnessEntry.findFirst({
        where: {
          id,
          userId: scope.userId,
        },
      });
      if (!row) {
        return null;
      }
      return mapToRecordEntity("wellness", row);
    }
  }
};

const listOwnedRecords = async (db: TransactionClient, scope: UserScope): Promise<readonly RecordEntity[]> => {
  const client = db as unknown as Record<string, { findMany: (args: unknown) => Promise<DbRecordPayload[]> }>;
  const types = recordTypeValues;
  const rows = await Promise.all(types.map(async (type) => {
    const model = type === "sleep" ? "sleepSession" : type === "phone-usage" ? "phoneUsageEntry" : `${type}Entry`;
    const include = type === "sleep" || type === "phone-usage" || type === "wellness" ? undefined : { dailyLog: { select: { localDate: true } } };
    return (await client[model].findMany({ where: { userId: scope.userId }, include })).map((row) => mapToRecordEntity(type, row));
  }));
  return rows.flat();
};

const createByType = async (
  db: TxDb,
  scope: UserScope,
  input: CreateRecordInput,
  localDate: string,
): Promise<RecordEntity> => {
  switch (input.type) {
    case "sleep": {
      const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);
      const row = await db.sleepSession.create({
        data: {
          userId: scope.userId,
          dailyLogId,
          sleepDate: localDate,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          morningFatigue: input.morningFatigue,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("sleep", row);
    }
    case "caffeine": {
      const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);
      const row = await db.caffeineEntry.create({
        data: {
          userId: scope.userId,
          dailyLogId,
          brand: input.brand,
          product: input.product,
          caffeineMg: input.caffeineMg,
          consumedAt: input.consumedAt,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("caffeine", row);
    }
    case "alcohol": {
      const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);
      const row = await db.alcoholEntry.create({
        data: {
          userId: scope.userId,
          dailyLogId,
          alcoholType: input.alcoholType,
          servings: input.servings,
          consumedAt: input.consumedAt,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("alcohol", row);
    }
    case "meal": {
      const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);
      const row = await db.mealEntry.create({
        data: {
          userId: scope.userId,
          dailyLogId,
          size: input.size,
          eatenAt: input.eatenAt,
          notes: input.notes,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("meal", row);
    }
    case "exercise": {
      const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);
      const row = await db.exerciseEntry.create({
        data: {
          userId: scope.userId,
          dailyLogId,
          exerciseType: input.exerciseType,
          intensity: input.intensity,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          averageHeartRate: input.averageHeartRate,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("exercise", row);
    }
    case "phone-usage": {
      const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);
      const row = await db.phoneUsageEntry.create({
        data: {
          userId: scope.userId,
          dailyLogId,
          localDate,
          lastUseAt: input.lastUseAt,
          durationMinutes: input.durationMinutes,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("phone-usage", row);
    }
    case "wellness": {
      const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);
      const row = await db.wellnessEntry.create({
        data: {
          userId: scope.userId,
          dailyLogId,
          localDate,
          fatigueLevel: input.fatigueLevel,
          stressLevel: input.stressLevel,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("wellness", row);
    }
    default:
      throw new Error("Unsupported record type");
  }
};

const updateByType = async (
  db: TxDb,
  scope: UserScope,
  type: RecordType,
  id: string,
  input: UpdateRecordInput,
  localDate: string,
): Promise<RecordEntity> => {
  const dailyLogId = await resolveDailyLogId(db, scope, localDate, input.timezone);

  switch (type) {
    case "sleep": {
      const row = await db.sleepSession.update({
        where: { id },
        data: {
          dailyLogId,
          sleepDate: localDate,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          morningFatigue: input.morningFatigue,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("sleep", row);
    }
    case "caffeine": {
      const row = await db.caffeineEntry.update({
        where: { id },
        data: {
          dailyLogId,
          brand: input.brand,
          product: input.product,
          caffeineMg: input.caffeineMg,
          consumedAt: input.consumedAt,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("caffeine", row);
    }
    case "alcohol": {
      const row = await db.alcoholEntry.update({
        where: { id },
        data: {
          dailyLogId,
          alcoholType: input.alcoholType,
          servings: input.servings,
          consumedAt: input.consumedAt,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("alcohol", row);
    }
    case "meal": {
      const row = await db.mealEntry.update({
        where: { id },
        data: {
          dailyLogId,
          size: input.size,
          eatenAt: input.eatenAt,
          notes: input.notes,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("meal", row);
    }
    case "exercise": {
      const row = await db.exerciseEntry.update({
        where: { id },
        data: {
          dailyLogId,
          exerciseType: input.exerciseType,
          intensity: input.intensity,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          averageHeartRate: input.averageHeartRate,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("exercise", row);
    }
    case "phone-usage": {
      const row = await db.phoneUsageEntry.update({
        where: { id },
        data: {
          dailyLogId,
          localDate,
          lastUseAt: input.lastUseAt,
          durationMinutes: input.durationMinutes,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("phone-usage", row);
    }
    case "wellness": {
      const row = await db.wellnessEntry.update({
        where: { id },
        data: {
          dailyLogId,
          localDate,
          fatigueLevel: input.fatigueLevel,
          stressLevel: input.stressLevel,
          timezone: input.timezone,
        },
      });
      return mapToRecordEntity("wellness", row);
    }
    default:
      throw new Error("Unsupported record type");
  }
};

export const createRecordRepository = (db: TransactionClient, scope: UserScope): RecordRepository => {
  const client = asTx(db);

  return {
    listOwnedRecords: async () => listOwnedRecords(db, scope),
    findById: async (type, id) => {
      if (!isRecordType(type)) {
        return null;
      }

      return readByType(client, scope, type, id);
    },
    create: async (type, input) => {
      if (!isRecordType(type)) {
        throw new Error("INVALID_RECORD_TYPE");
      }
      if (type !== input.type) {
        throw new Error("INVALID_RECORD_TYPE");
      }

      const localDate = deriveLocalDate(input);
      return createByType(client, scope, input, localDate);
    },
    update: async (type, id, input) => {
      if (!isRecordType(type)) {
        throw new Error("INVALID_RECORD_TYPE");
      }

      const existing = await readByType(client, scope, type, id);
      if (!existing) {
        throw new Error("RECORD_NOT_FOUND");
      }

      const localDate = deriveLocalDate(input);
      return updateByType(client, scope, type, id, input, localDate);
    },
    delete: async (type, id) => {
      if (!isRecordType(type)) {
        throw new Error("INVALID_RECORD_TYPE");
      }

      const existing = await readByType(client, scope, type, id);
      if (!existing) {
        throw new Error("RECORD_NOT_FOUND");
      }

      switch (type) {
        case "sleep":
          await client.sleepSession.delete({ where: { id } });
          break;
        case "caffeine":
          await client.caffeineEntry.delete({ where: { id } });
          break;
        case "alcohol":
          await client.alcoholEntry.delete({ where: { id } });
          break;
        case "meal":
          await client.mealEntry.delete({ where: { id } });
          break;
        case "exercise":
          await client.exerciseEntry.delete({ where: { id } });
          break;
        case "phone-usage":
          await client.phoneUsageEntry.delete({ where: { id } });
          break;
        case "wellness":
          await client.wellnessEntry.delete({ where: { id } });
          break;
      }
    },
    appendRevision: async (input) => {
      await client.recordRevision.create({
        data: {
          userId: scope.userId,
          entityType: input.entityType,
          entityId: input.entityId,
          operation: input.operation,
          before: input.before,
          after: input.after,
          changedAt: input.changedAt,
        },
      });
    },
  };
};
