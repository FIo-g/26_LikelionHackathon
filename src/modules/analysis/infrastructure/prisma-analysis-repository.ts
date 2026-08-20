import { assertJsonSize, parseVersionedJson } from "@/shared/validation/versioned-json";
import { analysisResultSchema } from "@/modules/analysis/domain/schemas";
import { calculateSleepImpact } from "@/modules/analysis/domain/calculate-sleep-impact";
import { ROLLING_ANALYSIS_DAYS } from "@/modules/records/application/affected-analysis-dates";
import type { AnalysisResult, AnalysisSnapshotEntity, ImpactFactorEntity, NormalizedAnalysisInput, NormalizedDailyRecords, SleepImpactResult } from "@/modules/analysis/application/ports";
import type { AnalysisSnapshotStatus } from "@/modules/analysis/application/ports";
import type { AnalysisRepository } from "@/modules/analysis/application/ports";
import type { BaselineSnapshotEntity } from "@/modules/analysis/application/ports";
import type { AnalysisRepositoryFactory, UserScope } from "@/modules/analysis/application/ports";
import type { AnalysisResult as DomainAnalysisResult, NormalizedAnalysisInput as DomainNormalizedAnalysisInput, NormalizedDailyRecords as DomainNormalizedDailyRecords, SleepGoal } from "@/modules/analysis/domain/types";
import type { TransactionClient } from "@/shared/db/transaction";
import type { ParseResult } from "@/modules/analysis/application/ports";
import type { CorruptAnalysisSnapshotFailure } from "@/modules/analysis/application/ports";

type PrismaAnalysisClient = TransactionClient & {
  sleepGoal: {
    findUnique: (args: unknown) => Promise<{
      targetBedTime: string;
      targetWakeTime: string;
      targetDurationMinutes: number;
    } | null>;
  };
  sleepSession: {
    findMany: (args: unknown) => Promise<Array<{
      sleepDate: string;
      startedAt: Date;
      endedAt: Date;
      timezone: string;
      updatedAt: Date;
    }>>;
  };
  caffeineEntry: {
    findMany: (args: unknown) => Promise<Array<{
      caffeineMg: number;
      consumedAt: Date;
      dailyLog?: {
        localDate: string;
      } | null;
      updatedAt: Date;
    }>>;
  };
  alcoholEntry: {
    findMany: (args: unknown) => Promise<Array<{
      servings: number;
      consumedAt: Date;
      dailyLog?: {
        localDate: string;
      } | null;
      updatedAt: Date;
    }>>;
  };
  mealEntry: {
    findMany: (args: unknown) => Promise<Array<{
      eatenAt: Date;
      dailyLog?: {
        localDate: string;
      } | null;
      updatedAt: Date;
    }>>;
  };
  exerciseEntry: {
    findMany: (args: unknown) => Promise<Array<{
      startedAt: Date;
      endedAt: Date;
      durationMinutes: number;
      updatedAt: Date;
      dailyLog?: {
        localDate: string;
      } | null;
    }>>;
  };
  phoneUsageEntry: {
    findMany: (args: unknown) => Promise<Array<{
      localDate: string;
      lastUseAt: Date;
      durationMinutes: number;
      updatedAt: Date;
    }>>;
  };
  wellnessEntry: {
    findMany: (args: unknown) => Promise<Array<{
      localDate: string;
      fatigueLevel: number;
      stressLevel: number;
      updatedAt: Date;
    }>>;
  };
  analysisSnapshot: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      localDate: string;
      timezone: string;
      status: AnalysisSnapshotStatus;
      result: unknown;
      generatedAt: Date;
      supersededAt: Date | null;
    }>>;
    updateMany: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<{ id: string }>;
  };
  impactFactor: {
    createMany: (args: unknown) => Promise<unknown>;
  };
};

type StoredAnalysisSnapshot = Readonly<{
  id: string;
  localDate: string;
  timezone: string;
  status: "current" | "superseded";
  result: unknown;
  generatedAt: Date;
  supersededAt: Date | null;
}>;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const assertLocalDate = (value: string): void => {
  if (!LOCAL_DATE_RE.test(value)) {
    throw new Error("INVALID_LOCAL_DATE");
  }
};

const assertString = (value: unknown): string => String(value);
const toDate = (value: unknown): Date => value instanceof Date ? value : new Date(String(value));
const toNumber = (value: unknown): number => Number(value);

const parseMinuteToNumber = (time: string): number | null => {
  const [hour, minute] = time.split(":");
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);

  if (!Number.isFinite(hourNumber) || !Number.isFinite(minuteNumber)) {
    return null;
  }

  if (hourNumber < 0 || hourNumber > 23 || minuteNumber < 0 || minuteNumber > 59) {
    return null;
  }

  return hourNumber * 60 + minuteNumber;
};

const toMinuteOfDay = (value: Date, timezone: string): number | null => {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    });

    const parts = fmt.formatToParts(value);
    const hourPart = parts.find((part) => part.type === "hour");
    const minutePart = parts.find((part) => part.type === "minute");

    if (!hourPart || !minutePart) {
      return null;
    }

    const hour = Number(hourPart.value);
    const minute = Number(minutePart.value);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    return (hour * 60 + minute) % 1440;
  } catch {
    return null;
  }
};

const toAnalysisDateRange = (localDate: string, days = ROLLING_ANALYSIS_DAYS): readonly string[] => {
  assertLocalDate(localDate);

  const endMs = Date.parse(`${localDate}T00:00:00.000Z`);
  const safeDays = Math.max(1, days);
  const startMs = endMs - (safeDays - 1) * DAY_MS;
  const dates: string[] = [];

  for (let index = 0; index < safeDays; index += 1) {
    dates.push(new Date(startMs + index * DAY_MS).toISOString().slice(0, 10));
  }

  return dates;
};

const createDefaultDay = (localDate: string): DomainNormalizedDailyRecords => ({
  localDate,
  sleepMinutes: null,
  bedMinuteOfDay: null,
  wakeMinuteOfDay: null,
  caffeine: [],
  alcoholServings: null,
  lastPhoneUseAt: null,
  phoneDurationMinutes: null,
  exerciseMinutes: null,
  lastMealAt: null,
  fatigueLevel: null,
  stressLevel: null,
});

const toAnalysisSnapshot = (raw: CorruptAnalysisSnapshotFailure): ParseResult<AnalysisSnapshotEntity> => ({
  ok: false,
  failure: raw,
});

const parseStoredResult = (value: unknown, snapshotId: string): ParseResult<AnalysisResult> => {
  try {
    const asString = typeof value === "string"
      ? value
      : JSON.stringify(value);

    if (!asString) {
      return toAnalysisSnapshot({
        code: "CORRUPT_ANALYSIS_SNAPSHOT",
        snapshotId,
      }) as ParseResult<AnalysisResult>;
    }

    const parsed = parseVersionedJson<{ analysisResult: AnalysisResult }>(asString);
    const result = analysisResultSchema.parse(parsed.analysisResult);

    return {
      ok: true,
      value: result,
    };
  } catch {
    return {
      ok: false,
      failure: {
        code: "CORRUPT_ANALYSIS_SNAPSHOT",
        snapshotId,
      },
    };
  }
};

const normalizeSet = (rows: readonly string[]): string[] => [...new Set(rows)].sort();

export const createAnalysisImpactRows = (input: DomainNormalizedAnalysisInput): ReadonlyArray<ImpactFactorEntity> => {
  const toExposureRows = (
    predicate: (row: DomainNormalizedDailyRecords) => boolean,
  ): number[] => input.days
    .filter((row) => row.sleepMinutes !== null && predicate(row))
    .map((row) => row.sleepMinutes as number);

  const toUnexposedRows = (
    predicate: (row: DomainNormalizedDailyRecords) => boolean,
  ): number[] => input.days
    .filter((row) => row.sleepMinutes !== null && !predicate(row))
    .map((row) => row.sleepMinutes as number);

  const impactRows: SleepImpactResult[] = [
    calculateSleepImpact({
      factor: "caffeine",
      exposed: toExposureRows((row) => row.caffeine.length > 0),
      unexposed: toUnexposedRows((row) => row.caffeine.length > 0),
    }),
    calculateSleepImpact({
      factor: "phone",
      exposed: toExposureRows((row) => row.lastPhoneUseAt !== null),
      unexposed: toUnexposedRows((row) => row.lastPhoneUseAt !== null),
    }),
    calculateSleepImpact({
      factor: "alcohol",
      exposed: toExposureRows((row) => (row.alcoholServings ?? 0) > 0),
      unexposed: toUnexposedRows((row) => (row.alcoholServings ?? 0) > 0),
    }),
    calculateSleepImpact({
      factor: "meal",
      exposed: toExposureRows((row) => row.lastMealAt !== null),
      unexposed: toUnexposedRows((row) => row.lastMealAt !== null),
    }),
    calculateSleepImpact({
      factor: "exercise",
      exposed: toExposureRows((row) => row.exerciseMinutes !== null),
      unexposed: toUnexposedRows((row) => row.exerciseMinutes !== null),
    }),
  ];

  return impactRows.map((impact) => ({
    factor: impact.factor,
    exposedCount: impact.exposedCount,
    unexposedCount: impact.unexposedCount,
    deltaMinutes: impact.deltaMinutes,
    confidence: impact.confidence,
    evidence: [...impact.evidence],
  }));
};

const loadWindowFromDb = async (
  db: PrismaAnalysisClient,
  scope: UserScope,
  localDate: string,
  days: number,
): Promise<DomainNormalizedAnalysisInput> => {
  assertLocalDate(localDate);

  const sleepGoal = await db.sleepGoal.findUnique({
    where: { userId: scope.userId },
    select: {
      targetBedTime: true,
      targetWakeTime: true,
      targetDurationMinutes: true,
    },
  });

  if (!sleepGoal) {
    throw new Error("MISSING_SLEEP_GOAL");
  }

  const parsedDays = toAnalysisDateRange(localDate, days);
  const dateSet = normalizeSet(parsedDays);

  const [sleepSessions, caffeineRows, alcoholRows, mealRows, exerciseRows, phoneRows, wellnessRows] = await Promise.all([
    db.sleepSession.findMany({
      where: {
        userId: scope.userId,
        sleepDate: { in: dateSet },
        timezone: scope.timezone,
      },
      orderBy: { updatedAt: "asc" },
      select: {
        sleepDate: true,
        startedAt: true,
        endedAt: true,
        timezone: true,
        updatedAt: true,
      },
    }),
    db.caffeineEntry.findMany({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        dailyLog: {
          localDate: { in: dateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
      include: { dailyLog: { select: { localDate: true } } },
      select: {
        caffeineMg: true,
        consumedAt: true,
        dailyLog: { select: { localDate: true } },
        updatedAt: true,
      },
    }),
    db.alcoholEntry.findMany({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        dailyLog: {
          localDate: { in: dateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
      include: { dailyLog: { select: { localDate: true } } },
      select: {
        servings: true,
        consumedAt: true,
        dailyLog: { select: { localDate: true } },
        updatedAt: true,
      },
    }),
    db.mealEntry.findMany({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        dailyLog: {
          localDate: { in: dateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
      include: { dailyLog: { select: { localDate: true } } },
      select: {
        eatenAt: true,
        dailyLog: { select: { localDate: true } },
        updatedAt: true,
      },
    }),
    db.exerciseEntry.findMany({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        dailyLog: {
          localDate: { in: dateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
      include: { dailyLog: { select: { localDate: true } } },
      select: {
        startedAt: true,
        endedAt: true,
        updatedAt: true,
        durationMinutes: true,
      },
    }),
    db.phoneUsageEntry.findMany({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        localDate: { in: dateSet },
      },
      orderBy: { updatedAt: "asc" },
      select: {
        localDate: true,
        lastUseAt: true,
        durationMinutes: true,
        updatedAt: true,
      },
    }),
    db.wellnessEntry.findMany({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        localDate: { in: dateSet },
      },
      orderBy: { updatedAt: "asc" },
      select: {
        localDate: true,
        fatigueLevel: true,
        stressLevel: true,
        updatedAt: true,
      },
    }),
  ]);

  const daysByDate = new Map<string, DomainNormalizedDailyRecords>(dateSet.map((item) => [item, createDefaultDay(item)]));

  for (const row of sleepSessions) {
    const day = daysByDate.get(assertString(row.sleepDate));
    if (!day) {
      continue;
    }

    const startedAt = toDate(row.startedAt);
    const endedAt = toDate(row.endedAt);
    const diffMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

    if (Number.isFinite(diffMinutes) && diffMinutes > 0) {
      day.sleepMinutes = diffMinutes;
      day.bedMinuteOfDay = toMinuteOfDay(startedAt, row.timezone);
      day.wakeMinuteOfDay = toMinuteOfDay(endedAt, row.timezone);
    }
  }

  for (const row of caffeineRows) {
    const rowDate = row.dailyLog?.localDate;
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

    day.caffeine.push({
      consumedAt: toDate(row.consumedAt).toISOString(),
      caffeineMg: toNumber(row.caffeineMg),
    });
  }

  for (const row of alcoholRows) {
    const rowDate = row.dailyLog?.localDate;
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

    const servings = toNumber(row.servings);
    if (Number.isFinite(servings)) {
      day.alcoholServings = (day.alcoholServings ?? 0) + servings;
    }
  }

  for (const row of mealRows) {
    const rowDate = row.dailyLog?.localDate;
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

    const mealTime = toDate(row.eatenAt);
    if (!day.lastMealAt || mealTime.getTime() > new Date(day.lastMealAt).getTime()) {
      day.lastMealAt = mealTime.toISOString();
    }
  }

  for (const row of exerciseRows) {
    const rowDate = row.dailyLog?.localDate;
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

    const startedAt = toDate(row.startedAt);
    const endedAt = toDate(row.endedAt);
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
      day.exerciseMinutes = (day.exerciseMinutes ?? 0) + durationMinutes;
    }
  }

  for (const row of phoneRows) {
    const day = daysByDate.get(assertString(row.localDate));
    if (!day) {
      continue;
    }

    const lastUseAt = toDate(row.lastUseAt);
    if (!day.lastPhoneUseAt || lastUseAt.getTime() > new Date(day.lastPhoneUseAt).getTime()) {
      day.lastPhoneUseAt = lastUseAt.toISOString();
      day.phoneDurationMinutes = toNumber(row.durationMinutes);
    }
  }

  for (const row of wellnessRows) {
    const day = daysByDate.get(assertString(row.localDate));
    if (!day) {
      continue;
    }

    day.fatigueLevel = toNumber(row.fatigueLevel);
    day.stressLevel = toNumber(row.stressLevel);
  }

  const fallback: SleepGoal = {
    targetBedTime: sleepGoal.targetBedTime,
    targetWakeTime: sleepGoal.targetWakeTime,
    targetDurationMinutes: sleepGoal.targetDurationMinutes,
  };

  return {
    localDate,
    timezone: scope.timezone,
    goal: fallback,
    days: normalizeSet(dateSet).map((item) => ({
      ...daysByDate.get(item)!,
    })),
    computedAt: new Date().toISOString(),
  };
};

const analysisSnapshotCurrentKey = (scope: UserScope, localDate: string): string => `${scope.userId}:${scope.timezone}:${localDate}`;

const findSnapshot = async (
  client: PrismaAnalysisClient,
  scope: UserScope,
  localDate: string,
  options: { includeCurrentOnly: boolean },
): Promise<StoredAnalysisSnapshot | null> => {
  const [row] = await client.analysisSnapshot.findMany({
    where: {
      userId: scope.userId,
      timezone: scope.timezone,
      localDate,
      ...(options.includeCurrentOnly ? { status: "current" } : {}),
    },
    orderBy: {
      generatedAt: "desc",
    },
    take: 1,
  });

  if (!row) {
    return null;
  }

  return row as StoredAnalysisSnapshot;
};

export const createAnalysisRepository = (db: TransactionClient, scope: UserScope): AnalysisRepository => {
  const client = db as PrismaAnalysisClient;

  return {
    loadWindow: async (localDate, days): Promise<DomainNormalizedAnalysisInput> => {
      return loadWindowFromDb(client, scope, localDate, days);
    },
    supersedeCurrent: async (localDate, at): Promise<void> => {
      assertLocalDate(localDate);

      await client.analysisSnapshot.updateMany({
        where: {
          userId: scope.userId,
          timezone: scope.timezone,
          localDate,
          status: "current",
        },
        data: {
          status: "superseded",
          supersededAt: at,
          currentKey: null,
        },
      });
    },
    saveCurrent: async (localDate, result, impactFactors): Promise<{ snapshotId: string }> => {
      assertLocalDate(localDate);

      const parsed = analysisResultSchema.parse(result);
      const payload = {
        schemaVersion: 1,
        analysisResult: parsed,
      } as const;

      assertJsonSize(payload);

      const snapshotId = await client.analysisSnapshot.create({
        data: {
          userId: scope.userId,
          localDate,
          timezone: scope.timezone,
          status: "current",
          result: payload,
          currentKey: analysisSnapshotCurrentKey(scope, localDate),
        },
      }).then((row) => row.id);

      if (impactFactors.length > 0) {
        await client.impactFactor.createMany({
          data: impactFactors.map((item) => ({
            analysisSnapshotId: snapshotId,
            factor: item.factor,
            exposedCount: item.exposedCount,
            unexposedCount: item.unexposedCount,
            deltaMinutes: item.deltaMinutes,
            confidence: item.confidence,
            evidence: item.evidence,
          })),
        });
      }

      return { snapshotId };
    },
    findCurrent: async (localDate): Promise<ParseResult<AnalysisSnapshotEntity> | null> => {
      const row = await findSnapshot(client, scope, localDate, { includeCurrentOnly: true });
      if (!row) {
        return null;
      }

      const parsed = parseStoredResult(row.result, row.id);
      if (!parsed.ok) {
        return parsed;
      }

      return {
        ok: true,
        value: {
          id: row.id,
          localDate: row.localDate,
          timezone: row.timezone,
          status: row.status,
          result: parsed.value,
          generatedAt: row.generatedAt,
          supersededAt: row.supersededAt,
        },
      };
    },
    findLastSuccessful: async (localDate): Promise<ParseResult<AnalysisSnapshotEntity> | null> => {
      const rows = await client.analysisSnapshot.findMany({
        where: {
          userId: scope.userId,
          timezone: scope.timezone,
          localDate,
        },
        orderBy: {
          generatedAt: "desc",
        },
      }) as StoredAnalysisSnapshot[];

      for (const row of rows) {
        const parsed = parseStoredResult(row.result, row.id);
        if (!parsed.ok) {
          continue;
        }

        return {
          ok: true,
          value: {
            id: row.id,
            localDate: row.localDate,
            timezone: row.timezone,
            status: row.status,
            result: parsed.value,
            generatedAt: row.generatedAt,
            supersededAt: row.supersededAt,
          },
        };
      }

      if (!rows[0]) {
        return null;
      }

      return toAnalysisSnapshot({
        code: "CORRUPT_ANALYSIS_SNAPSHOT",
        snapshotId: rows[0].id,
      });
    },
  };
};

export const createSnapshotFactory = (): AnalysisRepositoryFactory => (
  tx,
  scope,
  options,
) => createAnalysisRepository(
  tx as TransactionClient,
  scope,
);

export const createAnalysisRepositoryFactory = createSnapshotFactory;

export const analysisSnapshotCurrentKeyValue = analysisSnapshotCurrentKey;
