import { describe, expect, it, vi } from "vitest";

import { getRecordHub } from "@/modules/records/application/get-record-hub";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

type RecordRow = { id: string; updatedAt: Date; [key: string]: unknown };

const fixedClock = { now: () => new Date("2026-08-21T03:00:00.000Z") };

const emptyFindMany = () => vi.fn(async (): Promise<RecordRow[]> => []);

const emptyPrisma = () => ({
  caffeineEntry: { findMany: emptyFindMany() },
  alcoholEntry: { findMany: emptyFindMany() },
  mealEntry: { findMany: emptyFindMany() },
  exerciseEntry: { findMany: emptyFindMany() },
  wellnessEntry: { findMany: emptyFindMany() },
  sleepSession: { findMany: emptyFindMany() },
  phoneUsageEntry: { findMany: emptyFindMany() },
});

describe("getRecordHub", () => {
  it("exposes the six Figma record categories through real focused forms", async () => {
    const prisma = emptyPrisma();

    const model = await getRecordHub(scope, {
      getPrisma: () => prisma,
      clock: fixedClock,
    });

    expect(
      model.categories.map((category) => ({
        type: category.type,
        label: category.label,
        href: category.href,
      })),
    ).toEqual([
      {
        type: "caffeine",
        label: "카페인",
        href: "/record/caffeine?step=brand",
      },
      { type: "alcohol", label: "알코올", href: "/record/alcohol?step=type" },
      {
        type: "meal",
        label: "식사",
        href: "/record/meal-health?step=meal&focus=meal",
      },
      {
        type: "exercise",
        label: "운동",
        href: "/record/meal-health?step=exercise-and-wellness&focus=exercise",
      },
      {
        type: "phone-usage",
        label: "휴대폰",
        href: "/record/sleep-phone?step=phone&focus=phone",
      },
      {
        type: "sleep",
        label: "수면",
        href: "/record/sleep-phone?step=sleep&focus=sleep",
      },
    ]);
    expect(
      model.categories.every((category) => category.presence === "empty"),
    ).toBe(true);
  });

  it("keeps a focused card's delete target narrow while preserving related edit values", async () => {
    const prisma = emptyPrisma();
    prisma.exerciseEntry.findMany.mockResolvedValue([
      {
        id: "exercise-1",
        updatedAt: new Date("2026-08-21T12:00:00.000Z"),
        exerciseType: "걷기",
        intensity: "medium",
        startedAt: new Date("2026-08-21T09:00:00.000Z"),
        endedAt: new Date("2026-08-21T09:30:00.000Z"),
        averageHeartRate: 105,
        dailyLog: { localDate: "2026-08-21" },
      },
    ]);
    prisma.wellnessEntry.findMany.mockResolvedValue([
      {
        id: "wellness-1",
        updatedAt: new Date("2026-08-21T12:00:00.000Z"),
        localDate: "2026-08-21",
        fatigueLevel: 2,
        stressLevel: 3,
      },
    ]);

    const model = await getRecordHub(scope, {
      getPrisma: () => prisma,
      clock: fixedClock,
    });
    const exercise = model.categories.find(
      (category) => category.type === "exercise",
    );

    expect(exercise?.records).toEqual([
      { recordId: "exercise-1", recordType: "exercise" },
    ]);
    expect(exercise?.editDraft?.values).toMatchObject({
      exerciseRecordId: "exercise-1",
      wellnessRecordId: "wellness-1",
    });
    expect(exercise?.summary).toBe(
      "마지막: 2026-08-21 · 저장 1건 · 컨디션 1건",
    );
    expect(prisma.exerciseEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: scope.userId,
          timezone: scope.timezone,
          dailyLog: {
            is: {
              userId: scope.userId,
              timezone: scope.timezone,
              localDate: "2026-08-21",
            },
          },
        },
      }),
    );
    expect(prisma.wellnessEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: scope.userId,
          timezone: scope.timezone,
          localDate: "2026-08-21",
        },
      }),
    );
  });

  it("selects and restores an alcohol measurement unit in the edit draft", async () => {
    const prisma = emptyPrisma();
    prisma.alcoholEntry.findMany.mockResolvedValue([
      {
        id: "alcohol-1",
        updatedAt: new Date("2026-08-21T12:00:00.000Z"),
        alcoholType: "맥주",
        servings: 2,
        measurementUnit: "can",
        consumedAt: new Date("2026-08-21T20:00:00.000Z"),
        dailyLog: { localDate: "2026-08-21" },
      },
    ]);

    const model = await getRecordHub(scope, {
      getPrisma: () => prisma,
      clock: fixedClock,
    });
    const alcohol = model.categories.find(
      (category) => category.type === "alcohol",
    );

    expect(prisma.alcoholEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: scope.userId,
          timezone: scope.timezone,
          dailyLog: {
            is: {
              userId: scope.userId,
              timezone: scope.timezone,
              localDate: "2026-08-21",
            },
          },
        },
        select: expect.objectContaining({ measurementUnit: true }),
      }),
    );
    expect(alcohol?.editDraft?.values).toMatchObject({
      recordId: "alcohol-1",
      alcoholType: "맥주",
      servings: "2",
      measurementUnit: "can",
    });
  });

  it("passes every current-day category record to the delete action while keeping edits on the latest record", async () => {
    const prisma = emptyPrisma();
    prisma.caffeineEntry.findMany.mockResolvedValue([
      {
        id: "caffeine-latest",
        updatedAt: new Date("2026-08-21T10:00:00.000Z"),
        brand: "카페 A",
        product: "아메리카노",
        caffeineMg: 125,
        consumedAt: new Date("2026-08-21T08:00:00.000Z"),
        dailyLog: { localDate: "2026-08-21" },
      },
      {
        id: "caffeine-earlier",
        updatedAt: new Date("2026-08-21T09:00:00.000Z"),
        brand: "카페 B",
        product: "라테",
        caffeineMg: 80,
        consumedAt: new Date("2026-08-21T07:00:00.000Z"),
        dailyLog: { localDate: "2026-08-21" },
      },
    ]);

    const model = await getRecordHub(scope, {
      getPrisma: () => prisma,
      clock: fixedClock,
    });
    const caffeine = model.categories.find(
      (category) => category.type === "caffeine",
    );

    expect(caffeine?.records).toEqual([
      { recordId: "caffeine-latest", recordType: "caffeine" },
      { recordId: "caffeine-earlier", recordType: "caffeine" },
    ]);
    expect(caffeine?.summary).toBe("마지막: 2026-08-21 · 저장 2건");
    expect(caffeine?.editDraft?.values.recordId).toBe("caffeine-latest");
  });
});
