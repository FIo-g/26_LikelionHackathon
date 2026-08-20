import { assertJsonSize, parseVersionedJson } from "@/shared/validation/versioned-json";
import { Temporal } from "@js-temporal/polyfill";
import {
  analysisResultSchemaEnvelope,
  baselineResultSchema,
  baselineResultSchemaEnvelope,
} from "@/modules/analysis/domain/schemas";
import {
  calculateSleepImpact,
  classifySleepImpactRow,
} from "@/modules/analysis/domain/calculate-sleep-impact";
import { ROLLING_ANALYSIS_DAYS } from "@/modules/records/application/affected-analysis-dates";
import type {
  AnalysisRepository,
  AnalysisRepositoryFactory,
  AnalysisSnapshotEntity,
  AnalysisSnapshotStatus,
  BaselineSnapshotEntity,
  CorruptAnalysisSnapshotFailure,
  ImpactFactorEntity,
  ParseResult,
} from "@/modules/analysis/application/ports";
import type { UserScope } from "@/shared/domain/contracts";
import type {
  AnalysisEnvelope,
  BaselineEnvelope,
  NormalizedAnalysisInput,
  NormalizedDailyRecords,
  SleepGoal,
  SleepImpactResult,
} from "@/modules/analysis/domain/types";
import type { TransactionClient } from "@/shared/db/transaction";

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
  baselineSnapshot: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      timezone: string;
      status: AnalysisSnapshotStatus;
      result: unknown;
      generatedAt: Date;
      supersededAt: Date | null;
    }>>;
    updateMany: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<{
      id: string;
      timezone?: string;
      status?: AnalysisSnapshotStatus;
      result?: unknown;
      generatedAt?: Date;
      supersededAt?: Date | null;
    }>;
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

type StoredBaselineSnapshot = Readonly<{
  id: string;
  timezone: string;
  status: "current" | "superseded";
  result: unknown;
  generatedAt: Date;
  supersededAt: Date | null;
}>;

type MutableNormalizedDailyRecords = {
  -readonly [Key in keyof NormalizedDailyRecords]: Key extends "caffeine"
    ? Array<NormalizedDailyRecords["caffeine"][number]>
    : NormalizedDailyRecords[Key];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const assertLocalDate = (value: string): void => {
  try {
    if (Temporal.PlainDate.from(value).toString() === value) {
      return;
    }
  } catch {
    // Fall through to the stable repository error below.
  }
  throw new Error("INVALID_LOCAL_DATE");
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

const createDefaultDay = (localDate: string): MutableNormalizedDailyRecords => ({
  localDate,
  sleepMinutes: null,
  bedMinuteOfDay: null,
  wakeMinuteOfDay: null,
  caffeine: [],
  alcoholServings: null,
  lastPhoneUseAt: null,
  phoneDurationMinutes: null,
  exerciseMinutes: null,
  lastExerciseAt: null,
  lastMealAt: null,
  fatigueLevel: null,
  stressLevel: null,
});

const toAnalysisSnapshot = (raw: CorruptAnalysisSnapshotFailure): ParseResult<AnalysisSnapshotEntity> => ({
  ok: false,
  failure: raw,
});

const parseStoredEnvelope = <T>(
  value: unknown,
  snapshotId: string,
  code: "CORRUPT_ANALYSIS_SNAPSHOT" | "CORRUPT_BASELINE_SNAPSHOT",
  parse: (value: unknown) => T,
): ParseResult<T> => {
  try {
    const asString = typeof value === "string"
      ? value
      : JSON.stringify(value);

    if (!asString) {
      return { ok: false, failure: { code, snapshotId } };
    }

    const versioned = parseVersionedJson<Record<string, unknown>>(asString);

    return {
      ok: true,
      value: parse(versioned),
    };
  } catch {
    return {
      ok: false,
      failure: {
        code,
        snapshotId,
      },
    };
  }
};

const parseStoredAnalysisEnvelope = (value: unknown, snapshotId: string): ParseResult<AnalysisEnvelope> => (
  parseStoredEnvelope(value, snapshotId, "CORRUPT_ANALYSIS_SNAPSHOT", (parsed) => analysisResultSchemaEnvelope.parse(parsed))
);

const parseStoredBaselineEnvelope = (value: unknown, snapshotId: string): ParseResult<BaselineEnvelope> => (
  parseStoredEnvelope(value, snapshotId, "CORRUPT_BASELINE_SNAPSHOT", (parsed) => baselineResultSchemaEnvelope.parse(parsed))
);

const normalizeSet = (rows: readonly string[]): string[] => [...new Set(rows)].sort();

const MIN_VALID_SLEEP_MINUTES = 120;
const MAX_VALID_SLEEP_MINUTES = 960;

export const createAnalysisImpactRows = (input: NormalizedAnalysisInput): ReadonlyArray<ImpactFactorEntity> => {
  const targetBedMinuteOfDay = parseMinuteToNumber(input.goal.targetBedTime) ?? 1380;
  const cohort = (factor: SleepImpactResult["factor"], exposed: boolean): number[] => input.days
    .filter((row) => {
      if (row.sleepMinutes === null || row.sleepMinutes < MIN_VALID_SLEEP_MINUTES || row.sleepMinutes > MAX_VALID_SLEEP_MINUTES) {
        return false;
      }
      return classifySleepImpactRow({
        factor,
        row,
        timezone: input.timezone,
        targetBedMinuteOfDay,
      })[exposed ? "exposed" : "unexposed"];
    })
    .map((row) => row.sleepMinutes as number);

  const impactRows: SleepImpactResult[] = [
    calculateSleepImpact({
      factor: "caffeine",
      exposed: cohort("caffeine", true),
      unexposed: cohort("caffeine", false),
    }),
    calculateSleepImpact({
      factor: "phone",
      exposed: cohort("phone", true),
      unexposed: cohort("phone", false),
    }),
    calculateSleepImpact({
      factor: "alcohol",
      exposed: cohort("alcohol", true),
      unexposed: cohort("alcohol", false),
    }),
    calculateSleepImpact({
      factor: "meal",
      exposed: cohort("meal", true),
      unexposed: cohort("meal", false),
    }),
    calculateSleepImpact({
      factor: "exercise",
      exposed: cohort("exercise", true),
      unexposed: cohort("exercise", false),
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
): Promise<NormalizedAnalysisInput> => {
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
  const firstDate = dateSet[0] ?? localDate;
  const recordDateSet = normalizeSet([
    Temporal.PlainDate.from(firstDate).subtract({ days: 1 }).toString(),
    ...dateSet,
  ]);

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
          localDate: { in: recordDateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
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
          localDate: { in: recordDateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
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
          localDate: { in: recordDateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
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
          localDate: { in: recordDateSet },
        },
      },
      orderBy: { updatedAt: "asc" },
      select: {
        startedAt: true,
        endedAt: true,
        dailyLog: { select: { localDate: true } },
        updatedAt: true,
      },
    }),
    db.phoneUsageEntry.findMany({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        localDate: { in: recordDateSet },
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

  const daysByDate = new Map<string, MutableNormalizedDailyRecords>(dateSet.map((item) => [item, createDefaultDay(item)]));

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

  const sleepDateForObservation = (observedAt: Date, fallbackDate: string | null | undefined): string | null => {
    const followingSleep = sleepSessions
      .map((session) => ({
        localDate: assertString(session.sleepDate),
        startedAt: toDate(session.startedAt),
      }))
      .filter((session) => {
        const gap = session.startedAt.getTime() - observedAt.getTime();
        return daysByDate.has(session.localDate) && gap >= 0 && gap <= DAY_MS;
      })
      .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())[0];

    if (followingSleep) {
      return followingSleep.localDate;
    }

    // No sleep session follows this observation yet (e.g. today, before tonight's
    // sleep is logged). Only fall back to the record's own day if that day's sleep
    // hasn't already happened -- otherwise this would misattribute e.g. an afternoon
    // behavior to a morning sleep that already ended before the behavior occurred.
    if (fallbackDate && daysByDate.get(fallbackDate)?.sleepMinutes === null) {
      return fallbackDate;
    }

    return null;
  };

  for (const row of caffeineRows) {
    const consumedAt = toDate(row.consumedAt);
    const rowDate = sleepDateForObservation(consumedAt, row.dailyLog?.localDate);
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

    day.caffeine.push({
      consumedAt: consumedAt.toISOString(),
      caffeineMg: toNumber(row.caffeineMg),
    });
  }

  for (const row of alcoholRows) {
    const consumedAt = toDate(row.consumedAt);
    const rowDate = sleepDateForObservation(consumedAt, row.dailyLog?.localDate);
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
    const mealTime = toDate(row.eatenAt);
    const rowDate = sleepDateForObservation(mealTime, row.dailyLog?.localDate);
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

    if (!day.lastMealAt || mealTime.getTime() > new Date(day.lastMealAt).getTime()) {
      day.lastMealAt = mealTime.toISOString();
    }
  }

  for (const row of exerciseRows) {
    const endedAt = toDate(row.endedAt);
    const rowDate = sleepDateForObservation(endedAt, row.dailyLog?.localDate);
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

    const startedAt = toDate(row.startedAt);
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
      day.exerciseMinutes = (day.exerciseMinutes ?? 0) + durationMinutes;
      if (!day.lastExerciseAt || endedAt.getTime() > new Date(day.lastExerciseAt).getTime()) {
        day.lastExerciseAt = endedAt.toISOString();
      }
    }
  }

  for (const row of phoneRows) {
    const lastUseAt = toDate(row.lastUseAt);
    const rowDate = sleepDateForObservation(lastUseAt, row.localDate);
    const day = rowDate ? daysByDate.get(assertString(rowDate)) : null;
    if (!day) {
      continue;
    }

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
const baselineSnapshotCurrentKey = (scope: UserScope): string => `${scope.userId}:${scope.timezone}:baseline`;

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

export const createAnalysisRepository = (
  db: TransactionClient,
  scope: UserScope,
  options: Readonly<{ now: () => Date }> = { now: () => new Date() },
): AnalysisRepository => {
  const client = db as PrismaAnalysisClient;

  return {
    loadWindow: async (localDate, days): Promise<NormalizedAnalysisInput> => {
      return loadWindowFromDb(client, scope, localDate, days);
    },
    supersedeCurrentBaseline: async (at): Promise<void> => {
      await client.baselineSnapshot.updateMany({
        where: {
          userId: scope.userId,
          timezone: scope.timezone,
          status: "current",
        },
        data: {
          status: "superseded",
          supersededAt: at,
          currentKey: null,
        },
      });
    },
    saveCurrentBaseline: async (result): Promise<BaselineSnapshotEntity> => {
      const baseline = baselineResultSchema.parse(result);
      const payload: BaselineEnvelope = { schemaVersion: 1, baseline };
      assertJsonSize(payload);
      const generatedAt = options.now();
      const row = await client.baselineSnapshot.create({
        data: {
          userId: scope.userId,
          timezone: scope.timezone,
          status: "current",
          result: payload,
          generatedAt,
          currentKey: baselineSnapshotCurrentKey(scope),
        },
      });
      return {
        id: row.id,
        timezone: scope.timezone,
        status: "current",
        result: baseline,
        generatedAt,
        supersededAt: null,
      };
    },
    findCurrentBaseline: async (): Promise<ParseResult<BaselineSnapshotEntity> | null> => {
      const [row] = await client.baselineSnapshot.findMany({
        where: {
          userId: scope.userId,
          timezone: scope.timezone,
          status: "current",
        },
        orderBy: { generatedAt: "desc" },
        take: 1,
      }) as StoredBaselineSnapshot[];
      if (!row) {
        return null;
      }
      const parsed = parseStoredBaselineEnvelope(row.result, row.id);
      if (!parsed.ok) {
        return parsed;
      }
      return {
        ok: true,
        value: {
          id: row.id,
          timezone: row.timezone,
          status: row.status,
          result: parsed.value.baseline,
          generatedAt: row.generatedAt,
          supersededAt: row.supersededAt,
        },
      };
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
    saveCurrent: async (localDate, baselineSnapshotId, result, impactFactors): Promise<{ snapshotId: string }> => {
      assertLocalDate(localDate);

      const payload = analysisResultSchemaEnvelope.parse({
        schemaVersion: 1,
        baselineSnapshotId,
        analysisResult: result,
      });

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
            userId: scope.userId,
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

      const parsed = parseStoredAnalysisEnvelope(row.result, row.id);
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
          baselineSnapshotId: parsed.value.baselineSnapshotId,
          result: parsed.value.analysisResult,
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
        const parsed = parseStoredAnalysisEnvelope(row.result, row.id);
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
            baselineSnapshotId: parsed.value.baselineSnapshotId,
            result: parsed.value.analysisResult,
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
  options,
);

export const createAnalysisRepositoryFactory = createSnapshotFactory;

export const analysisSnapshotCurrentKeyValue = analysisSnapshotCurrentKey;
export const baselineSnapshotCurrentKeyValue = baselineSnapshotCurrentKey;
