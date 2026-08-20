import { getPrismaClient } from "@/shared/db/prisma";
import type { UserScope } from "@/shared/domain/contracts";
import type { RecordType } from "../domain/types";

export type EntryPresence = "empty" | "draft" | "completed" | "error";
export type RecordInputMode = "manual";

export type RecordCategory = "카페인" | "음주" | "식사/운동/컨디션" | "수면/휴대폰";

export type RecordCategoryViewModel = Readonly<{
  type: RecordType;
  label: string;
  presence: EntryPresence;
  inputMode: RecordInputMode;
  summary: string | null;
  href: string;
}>;

export type RecordHubViewModel = Readonly<{
  categories: readonly RecordCategoryViewModel[];
}>;

type CategoryRecordRow = {
  id: string;
  updatedAt: Date;
  [key: string]: unknown;
};

type CategoryPresence = Readonly<{
  row: CategoryRecordRow | null;
  presentCount: number;
}>;

type CategoryRecordQuery = {
  findFirst: (args: {
    where: { userId: string };
    orderBy: { updatedAt: "desc" };
    select: Record<string, unknown>;
    include?: Record<string, unknown>;
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

const isRecordValue = (value: CategoryRecordRow | null): value is CategoryRecordRow => value !== null;

const summaryFromRow = (type: RecordType, row: CategoryRecordRow | null): string | null => {
  if (!row) {
    return null;
  }

  if (type === "sleep") {
    const sleepDate = typeof row.sleepDate === "string" ? row.sleepDate : null;
    return sleepDate ? `마지막: ${sleepDate}` : null;
  }

  if (type === "phone-usage" || type === "wellness") {
    const localDate = typeof row.localDate === "string" ? row.localDate : null;
    return localDate ? `마지막: ${localDate}` : null;
  }

  const dailyLog = row.dailyLog as { localDate?: string } | undefined;
  const localDate = typeof dailyLog?.localDate === "string" ? dailyLog.localDate : null;
  return localDate ? `마지막: ${localDate}` : null;
};

const mergeLatest = (rows: readonly (CategoryRecordRow | null)[]): CategoryPresence => {
  const filtered = rows.filter(isRecordValue);
  if (!filtered.length) {
    return { row: null, presentCount: 0 };
  }

  const sorted = [...filtered].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return { row: sorted[0], presentCount: filtered.length };
};

const derivePresence = (presentCount: number, requiredCount: number): EntryPresence => {
  if (presentCount === 0) {
    return "empty";
  }

  return presentCount >= requiredCount ? "completed" : "draft";
};

const categoryConfig = [
  {
    type: "caffeine" as RecordType,
    label: "카페인",
    requiredCount: 1,
    query: (client: PrismaRecordHubClient, userId: string): Promise<CategoryPresence> => client.caffeineEntry.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { dailyLog: { select: { localDate: true } } },
      select: {
        id: true,
        updatedAt: true,
        brand: true,
      },
    }).then((row) => ({ row, presentCount: row ? 1 : 0 })),
    href: "/record/caffeine?step=brand",
  },
  {
    type: "alcohol" as RecordType,
    label: "음주",
    requiredCount: 1,
    query: (client: PrismaRecordHubClient, userId: string): Promise<CategoryPresence> => client.alcoholEntry.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { dailyLog: { select: { localDate: true } } },
      select: {
        id: true,
        updatedAt: true,
        alcoholType: true,
      },
    }).then((row) => ({ row, presentCount: row ? 1 : 0 })),
    href: "/record/alcohol?step=type",
  },
  {
    type: "meal" as RecordType,
    label: "식사/운동/컨디션",
    requiredCount: 3,
    query: async (client: PrismaRecordHubClient, userId: string): Promise<CategoryPresence> => {
      const [meal, exercise, wellness] = await Promise.all([
        client.mealEntry.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          include: { dailyLog: { select: { localDate: true } } },
          select: { id: true, updatedAt: true, size: true },
        }),
        client.exerciseEntry.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          include: { dailyLog: { select: { localDate: true } } },
          select: { id: true, updatedAt: true, exerciseType: true },
        }),
        client.wellnessEntry.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: { id: true, updatedAt: true, fatigueLevel: true, localDate: true },
        }),
      ]);

      const merged = mergeLatest([meal, exercise, wellness]);
      return {
        row: merged.row,
        presentCount: Number(isRecordValue(meal)) + Number(isRecordValue(exercise)) + Number(isRecordValue(wellness)),
      };
    },
    href: "/record/meal-health?step=meal",
  },
  {
    type: "sleep" as RecordType,
    label: "수면/휴대폰",
    requiredCount: 2,
    query: async (client: PrismaRecordHubClient, userId: string): Promise<CategoryPresence> => {
      const [sleep, phone] = await Promise.all([
        client.sleepSession.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            updatedAt: true,
            sleepDate: true,
          },
        }),
        client.phoneUsageEntry.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            updatedAt: true,
            localDate: true,
          },
        }),
      ]);

      const merged = mergeLatest([sleep, phone]);
      return {
        row: merged.row,
        presentCount: Number(isRecordValue(sleep)) + Number(isRecordValue(phone)),
      };
    },
    href: "/record/sleep-phone?step=sleep",
  },
];

export const getRecordHub = async (scope: UserScope): Promise<RecordHubViewModel> => {
  const prisma = getPrismaClient() as PrismaRecordHubClient;

  const categories = await Promise.all(
    categoryConfig.map(async (category) => {
      const queryResult = await category.query(prisma, scope.userId);
      const summary = summaryFromRow(category.type, queryResult.row);
      const presence = derivePresence(queryResult.presentCount, category.requiredCount);

      return {
        type: category.type,
        label: category.label,
        presence,
        inputMode: "manual" as const,
        summary,
        href: category.href,
      } satisfies RecordCategoryViewModel;
    }),
  );

  return {
    categories: categories,
  };
};
