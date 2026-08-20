import { getPrismaClient } from "@/shared/db/prisma";
import type { UserScope } from "@/shared/domain/contracts";
import { formatRecordWallTime } from "@/shared/time/zoned-date-time";
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
  findFirst: (args: {
    where: { userId: string };
    orderBy: { updatedAt: "desc" };
    select: Record<string, unknown>;
  }) => Promise<CategoryRecordRow | null>;
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

type LoadedRecord = Readonly<{ type: RecordType; row: CategoryRecordRow }>;
type LoadedCategory = Readonly<{
  type: RecordType;
  label: string;
  requiredCount: number;
  href: string;
  step: string;
  records: readonly LoadedRecord[];
}>;

const selectLatest = async (
  query: CategoryRecordQuery,
  userId: string,
  select: Record<string, unknown>,
): Promise<CategoryRecordRow | null> => query.findFirst({
  where: { userId },
  orderBy: { updatedAt: "desc" },
  select: { id: true, updatedAt: true, ...select },
});

const present = (type: RecordType, row: CategoryRecordRow | null): LoadedRecord[] => (
  row ? [{ type, row }] : []
);

const latestRow = (records: readonly LoadedRecord[]): CategoryRecordRow | null => (
  records.length === 0
    ? null
    : [...records].sort((left, right) => right.row.updatedAt.getTime() - left.row.updatedAt.getTime())[0].row
);

const summaryFromRow = (row: CategoryRecordRow | null): string | null => {
  if (!row) return null;
  if (typeof row.sleepDate === "string") return `마지막: ${row.sleepDate}`;
  if (typeof row.localDate === "string") return `마지막: ${row.localDate}`;
  const dailyLog = row.dailyLog as { localDate?: unknown } | null | undefined;
  return typeof dailyLog?.localDate === "string" ? `마지막: ${dailyLog.localDate}` : null;
};

const derivePresence = (count: number, requiredCount: number): EntryPresence => {
  if (count === 0) return "empty";
  return count >= requiredCount ? "completed" : "draft";
};

const text = (value: unknown): string => value === null || value === undefined ? "" : String(value);
const wallTime = (value: unknown, timezone: string): string => formatRecordWallTime(
  value instanceof Date ? value : new Date(String(value)),
  timezone,
);

const draftValues = (records: readonly LoadedRecord[], timezone: string): Record<string, string> => {
  const values: Record<string, string> = {};

  for (const { type, row } of records) {
    switch (type) {
      case "caffeine":
        Object.assign(values, {
          recordId: row.id,
          brand: text(row.brand),
          product: text(row.product),
          caffeineMg: text(row.caffeineMg),
          consumedAt: wallTime(row.consumedAt, timezone),
        });
        break;
      case "alcohol":
        Object.assign(values, {
          recordId: row.id,
          alcoholType: text(row.alcoholType),
          servings: text(row.servings),
          consumedAt: wallTime(row.consumedAt, timezone),
        });
        break;
      case "meal":
        Object.assign(values, {
          mealRecordId: row.id,
          mealSize: text(row.size),
          mealEatenAt: wallTime(row.eatenAt, timezone),
          mealNotes: text(row.notes),
        });
        break;
      case "exercise":
        Object.assign(values, {
          exerciseRecordId: row.id,
          exerciseType: text(row.exerciseType),
          exerciseIntensity: text(row.intensity),
          exerciseStartedAt: wallTime(row.startedAt, timezone),
          exerciseEndedAt: wallTime(row.endedAt, timezone),
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
          sleepStartedAt: wallTime(row.startedAt, timezone),
          sleepEndedAt: wallTime(row.endedAt, timezone),
          morningFatigue: text(row.morningFatigue),
        });
        break;
      case "phone-usage":
        Object.assign(values, {
          phoneRecordId: row.id,
          lastUseAt: wallTime(row.lastUseAt, timezone),
          durationMinutes: text(row.durationMinutes),
        });
        break;
    }
  }

  return values;
};

const loadCategories = async (client: PrismaRecordHubClient, userId: string): Promise<LoadedCategory[]> => {
  const [caffeine, alcohol, meal, exercise, wellness, sleep, phone] = await Promise.all([
    selectLatest(client.caffeineEntry, userId, {
      brand: true, product: true, caffeineMg: true, consumedAt: true,
      dailyLog: { select: { localDate: true } },
    }),
    selectLatest(client.alcoholEntry, userId, {
      alcoholType: true, servings: true, consumedAt: true,
      dailyLog: { select: { localDate: true } },
    }),
    selectLatest(client.mealEntry, userId, {
      size: true, eatenAt: true, notes: true,
      dailyLog: { select: { localDate: true } },
    }),
    selectLatest(client.exerciseEntry, userId, {
      exerciseType: true, intensity: true, startedAt: true, endedAt: true, averageHeartRate: true,
      dailyLog: { select: { localDate: true } },
    }),
    selectLatest(client.wellnessEntry, userId, {
      localDate: true, fatigueLevel: true, stressLevel: true,
    }),
    selectLatest(client.sleepSession, userId, {
      sleepDate: true, startedAt: true, endedAt: true, morningFatigue: true,
    }),
    selectLatest(client.phoneUsageEntry, userId, {
      localDate: true, lastUseAt: true, durationMinutes: true,
    }),
  ]);

  return [
    { type: "caffeine", label: "카페인", requiredCount: 1, href: "/record/caffeine", step: "brand", records: present("caffeine", caffeine) },
    { type: "alcohol", label: "음주", requiredCount: 1, href: "/record/alcohol", step: "type", records: present("alcohol", alcohol) },
    { type: "meal", label: "식사/운동/컨디션", requiredCount: 3, href: "/record/meal-health", step: "meal", records: [...present("meal", meal), ...present("exercise", exercise), ...present("wellness", wellness)] },
    { type: "sleep", label: "수면/휴대폰", requiredCount: 2, href: "/record/sleep-phone", step: "sleep", records: [...present("sleep", sleep), ...present("phone-usage", phone)] },
  ];
};

export const getRecordHub = async (scope: UserScope): Promise<RecordHubViewModel> => {
  const loaded = await loadCategories(getPrismaClient() as unknown as PrismaRecordHubClient, scope.userId);
  return {
    categories: loaded.map((category) => ({
      type: category.type,
      label: category.label,
      presence: derivePresence(category.records.length, category.requiredCount),
      inputMode: "manual",
      summary: summaryFromRow(latestRow(category.records)),
      href: category.href,
      records: category.records.map(({ type, row }) => ({ recordId: row.id, recordType: type })),
      editDraft: category.records.length === 0
        ? null
        : { step: category.step, values: draftValues(category.records, scope.timezone) },
    })),
  };
};
