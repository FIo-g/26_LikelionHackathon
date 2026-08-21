import { getPrismaClient } from "@/shared/db/prisma";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import { systemClock } from "@/shared/time/system-clock";
import { formatRecordWallTimeInput } from "@/shared/time/zoned-date-time";
import type { RecordType } from "../domain/types";

export type EntryPresence = "empty" | "draft" | "completed" | "error";
export type RecordInputMode = "manual";

export type RecordEditDraft = Readonly<{
  step: string;
  values: Readonly<Record<string, string>>;
}>;

export type RecordCategoryViewModel = Readonly<{
  type: RecordType;
  label: string;
  presence: EntryPresence;
  inputMode: RecordInputMode;
  summary: string | null;
  href: string;
  records: readonly { recordId: string; recordType: RecordType }[];
  editDraft: RecordEditDraft | null;
}>;

export type RecordHubViewModel = Readonly<{
  categories: readonly RecordCategoryViewModel[];
}>;

type CategoryRecordRow = {
  id: string;
  updatedAt: Date;
  [key: string]: unknown;
};

type CategoryRecordQuery = {
  findMany: (args: {
    where: Record<string, unknown>;
    orderBy: { updatedAt: "desc" };
    select: Record<string, unknown>;
  }) => Promise<CategoryRecordRow[]>;
};

type PrismaRecordHubClient = {
  sleepSession: CategoryRecordQuery;
  caffeineEntry: CategoryRecordQuery;
  alcoholEntry: CategoryRecordQuery;
  mealEntry: CategoryRecordQuery;
  exerciseEntry: CategoryRecordQuery;
  phoneUsageEntry: CategoryRecordQuery;
  wellnessEntry: CategoryRecordQuery;
};

export type GetRecordHubDependencies = Readonly<{
  getPrisma?: () => PrismaRecordHubClient;
  clock?: Clock;
}>;

type LoadedRecord = Readonly<{ type: RecordType; row: CategoryRecordRow }>;
type LoadedCategory = Readonly<{
  type: RecordType;
  label: string;
  requiredCount: number;
  href: string;
  step: string;
  records: readonly LoadedRecord[];
  editRecords?: readonly LoadedRecord[];
  recordCount: number;
  relatedRecordCount?: number;
}>;

const selectCurrentRecords = async (
  query: CategoryRecordQuery,
  where: Record<string, unknown>,
  select: Record<string, unknown>,
): Promise<CategoryRecordRow[]> =>
  query.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true, ...select },
  });

const present = (
  type: RecordType,
  rows: readonly CategoryRecordRow[],
): LoadedRecord[] => rows.map((row) => ({ type, row }));

const latestRow = (
  records: readonly LoadedRecord[],
): CategoryRecordRow | null =>
  records.length === 0
    ? null
    : [...records].sort(
        (left, right) =>
          right.row.updatedAt.getTime() - left.row.updatedAt.getTime(),
      )[0].row;

const latestRecord = (
  type: RecordType,
  records: readonly LoadedRecord[],
): LoadedRecord[] => {
  const row = latestRow(records);
  return row ? [{ type, row }] : [];
};

const summaryFromRow = (row: CategoryRecordRow | null): string | null => {
  if (!row) return null;
  if (typeof row.sleepDate === "string") return `마지막: ${row.sleepDate}`;
  if (typeof row.localDate === "string") return `마지막: ${row.localDate}`;
  const dailyLog = row.dailyLog as { localDate?: unknown } | null | undefined;
  return typeof dailyLog?.localDate === "string"
    ? `마지막: ${dailyLog.localDate}`
    : null;
};

const summaryWithCount = (
  row: CategoryRecordRow | null,
  recordCount: number,
  relatedRecordCount?: number,
): string | null => {
  if (recordCount === 0) return null;

  const values = [
    summaryFromRow(row),
    `저장 ${recordCount}건`,
    relatedRecordCount === undefined ? null : `컨디션 ${relatedRecordCount}건`,
  ].filter((value): value is string => value !== null);
  return values.join(" · ");
};

const derivePresence = (
  count: number,
  requiredCount: number,
): EntryPresence => {
  if (count === 0) return "empty";
  return count >= requiredCount ? "completed" : "draft";
};

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);
const editableWallTime = (
  field: string,
  value: unknown,
  timezone: string,
): Record<string, string> => {
  const local = formatRecordWallTimeInput(
    value instanceof Date ? value : new Date(String(value)),
    timezone,
  );
  return {
    [field]: local.value,
    [`${field}Disambiguation`]: local.disambiguation ?? "",
  };
};

const draftValues = (
  records: readonly LoadedRecord[],
  timezone: string,
): Record<string, string> => {
  const values: Record<string, string> = {};

  for (const { type, row } of records) {
    switch (type) {
      case "caffeine":
        Object.assign(values, {
          recordId: row.id,
          brand: text(row.brand),
          product: text(row.product),
          caffeineMg: text(row.caffeineMg),
          ...editableWallTime("consumedAt", row.consumedAt, timezone),
        });
        break;
      case "alcohol":
        Object.assign(values, {
          recordId: row.id,
          alcoholType: text(row.alcoholType),
          servings: text(row.servings),
          measurementUnit: text(row.measurementUnit),
          ...editableWallTime("consumedAt", row.consumedAt, timezone),
        });
        break;
      case "meal":
        Object.assign(values, {
          mealRecordId: row.id,
          mealSize: text(row.size),
          ...editableWallTime("mealEatenAt", row.eatenAt, timezone),
          mealNotes: text(row.notes),
        });
        break;
      case "exercise":
        Object.assign(values, {
          exerciseRecordId: row.id,
          exerciseType: text(row.exerciseType),
          exerciseIntensity: text(row.intensity),
          ...editableWallTime("exerciseStartedAt", row.startedAt, timezone),
          ...editableWallTime("exerciseEndedAt", row.endedAt, timezone),
          exerciseAverageHeartRate: text(row.averageHeartRate),
        });
        break;
      case "wellness":
        Object.assign(values, {
          wellnessRecordId: row.id,
          wellnessLocalDate: text(row.localDate),
          fatigueLevel: text(row.fatigueLevel),
          stressLevel: text(row.stressLevel),
        });
        break;
      case "sleep":
        Object.assign(values, {
          sleepRecordId: row.id,
          ...editableWallTime("sleepStartedAt", row.startedAt, timezone),
          ...editableWallTime("sleepEndedAt", row.endedAt, timezone),
          morningFatigue: text(row.morningFatigue),
        });
        break;
      case "phone-usage":
        Object.assign(values, {
          phoneRecordId: row.id,
          ...editableWallTime("lastUseAt", row.lastUseAt, timezone),
          durationMinutes: text(row.durationMinutes),
        });
        break;
    }
  }

  return values;
};

const loadCategories = async (
  client: PrismaRecordHubClient,
  scope: UserScope,
  localDate: string,
): Promise<LoadedCategory[]> => {
  const dailyLogWhere = {
    userId: scope.userId,
    timezone: scope.timezone,
    dailyLog: {
      is: {
        userId: scope.userId,
        timezone: scope.timezone,
        localDate,
      },
    },
  };
  const directDailyWhere = {
    userId: scope.userId,
    timezone: scope.timezone,
    localDate,
  };
  const sleepWhere = {
    userId: scope.userId,
    timezone: scope.timezone,
    sleepDate: localDate,
  };
  const [caffeine, alcohol, meal, exercise, wellness, sleep, phone] =
    await Promise.all([
      selectCurrentRecords(client.caffeineEntry, dailyLogWhere, {
        brand: true,
        product: true,
        caffeineMg: true,
        consumedAt: true,
        dailyLog: { select: { localDate: true } },
      }),
      selectCurrentRecords(client.alcoholEntry, dailyLogWhere, {
        alcoholType: true,
        servings: true,
        consumedAt: true,
        dailyLog: { select: { localDate: true } },
      }),
      selectCurrentRecords(client.mealEntry, dailyLogWhere, {
        size: true,
        eatenAt: true,
        notes: true,
        dailyLog: { select: { localDate: true } },
      }),
      selectCurrentRecords(client.exerciseEntry, dailyLogWhere, {
        exerciseType: true,
        intensity: true,
        startedAt: true,
        endedAt: true,
        averageHeartRate: true,
        dailyLog: { select: { localDate: true } },
      }),
      selectCurrentRecords(client.wellnessEntry, directDailyWhere, {
        localDate: true,
        fatigueLevel: true,
        stressLevel: true,
      }),
      selectCurrentRecords(client.sleepSession, sleepWhere, {
        sleepDate: true,
        startedAt: true,
        endedAt: true,
        morningFatigue: true,
      }),
      selectCurrentRecords(client.phoneUsageEntry, directDailyWhere, {
        localDate: true,
        lastUseAt: true,
        durationMinutes: true,
      }),
    ]);

  const mealRecords = present("meal", meal);
  const exerciseRecords = present("exercise", exercise);
  const wellnessRecords = present("wellness", wellness);
  const sleepRecords = present("sleep", sleep);
  const phoneRecords = present("phone-usage", phone);
  const caffeineRecords = present("caffeine", caffeine);
  const alcoholRecords = present("alcohol", alcohol);

  return [
    {
      type: "caffeine",
      label: "카페인",
      requiredCount: 1,
      href: "/record/caffeine?step=brand",
      step: "brand",
      records: caffeineRecords,
      editRecords: latestRecord("caffeine", caffeineRecords),
      recordCount: caffeineRecords.length,
    },
    {
      type: "alcohol",
      label: "알코올",
      requiredCount: 1,
      href: "/record/alcohol?step=type",
      step: "type",
      records: alcoholRecords,
      editRecords: latestRecord("alcohol", alcoholRecords),
      recordCount: alcoholRecords.length,
    },
    {
      type: "meal",
      label: "식사",
      requiredCount: 1,
      href: "/record/meal-health?step=meal&focus=meal",
      step: "meal",
      records: mealRecords,
      editRecords: latestRecord("meal", mealRecords),
      recordCount: mealRecords.length,
    },
    {
      type: "exercise",
      label: "운동",
      requiredCount: 1,
      href: "/record/meal-health?step=exercise-and-wellness&focus=exercise",
      step: "exercise-and-wellness",
      records: exerciseRecords,
      editRecords: [
        ...latestRecord("exercise", exerciseRecords),
        ...latestRecord("wellness", wellnessRecords),
      ],
      recordCount: exerciseRecords.length,
      relatedRecordCount: wellnessRecords.length,
    },
    {
      type: "phone-usage",
      label: "휴대폰",
      requiredCount: 1,
      href: "/record/sleep-phone?step=phone&focus=phone",
      step: "phone",
      records: phoneRecords,
      editRecords: latestRecord("phone-usage", phoneRecords),
      recordCount: phoneRecords.length,
    },
    {
      type: "sleep",
      label: "수면",
      requiredCount: 1,
      href: "/record/sleep-phone?step=sleep&focus=sleep",
      step: "sleep",
      records: sleepRecords,
      editRecords: latestRecord("sleep", sleepRecords),
      recordCount: sleepRecords.length,
    },
  ];
};

export const getRecordHub = async (
  scope: UserScope,
  dependencies: GetRecordHubDependencies = {},
): Promise<RecordHubViewModel> => {
  const prisma = dependencies.getPrisma
    ? dependencies.getPrisma()
    : (getPrismaClient() as unknown as PrismaRecordHubClient);
  const localDate = wakeLocalDate(
    (dependencies.clock ?? systemClock).now(),
    scope.timezone,
  );
  const loaded = await loadCategories(prisma, scope, localDate);
  return {
    categories: loaded.map((category) => ({
      type: category.type,
      label: category.label,
      presence: derivePresence(category.records.length, category.requiredCount),
      inputMode: "manual",
      summary: summaryWithCount(
        latestRow(category.records),
        category.recordCount,
        category.relatedRecordCount,
      ),
      href: category.href,
      records: category.records.map(({ type, row }) => ({
        recordId: row.id,
        recordType: type,
      })),
      editDraft:
        category.records.length === 0
          ? null
          : {
              step: category.step,
              values: draftValues(
                category.editRecords ?? category.records,
                scope.timezone,
              ),
            },
    })),
  };
};
