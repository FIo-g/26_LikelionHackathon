import { describe, expect, it, vi } from "vitest";

import { getRecordHub } from "@/modules/records/application/get-record-hub";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

type RecordRow = { id: string; updatedAt: Date; [key: string]: unknown };

const emptyFindFirst = () => vi.fn(async (): Promise<RecordRow | null> => null);

const emptyPrisma = () => ({
  caffeineEntry: { findFirst: emptyFindFirst(), count: vi.fn(async () => 0) },
  alcoholEntry: { findFirst: emptyFindFirst(), count: vi.fn(async () => 0) },
  mealEntry: { findFirst: emptyFindFirst(), count: vi.fn(async () => 0) },
  exerciseEntry: { findFirst: emptyFindFirst(), count: vi.fn(async () => 0) },
  wellnessEntry: { findFirst: emptyFindFirst(), count: vi.fn(async () => 0) },
  sleepSession: { findFirst: emptyFindFirst(), count: vi.fn(async () => 0) },
  phoneUsageEntry: { findFirst: emptyFindFirst(), count: vi.fn(async () => 0) },
});

describe("getRecordHub", () => {
  it("exposes the six Figma record categories through real focused forms", async () => {
    const prisma = emptyPrisma();

    const model = await getRecordHub(scope, { getPrisma: () => prisma });

    expect(model.categories.map((category) => ({ type: category.type, label: category.label, href: category.href }))).toEqual([
      { type: "caffeine", label: "카페인", href: "/record/caffeine?step=brand" },
      { type: "alcohol", label: "알코올", href: "/record/alcohol?step=type" },
      { type: "meal", label: "식사", href: "/record/meal-health?step=meal&focus=meal" },
      { type: "exercise", label: "운동", href: "/record/meal-health?step=exercise-and-wellness&focus=exercise" },
      { type: "phone-usage", label: "휴대폰", href: "/record/sleep-phone?step=phone&focus=phone" },
      { type: "sleep", label: "수면", href: "/record/sleep-phone?step=sleep&focus=sleep" },
    ]);
    expect(model.categories.every((category) => category.presence === "empty")).toBe(true);
  });

  it("keeps a focused card's delete target narrow while preserving related edit values", async () => {
    const prisma = emptyPrisma();
    prisma.exerciseEntry.findFirst.mockResolvedValue({
      id: "exercise-1",
      updatedAt: new Date("2026-08-20T12:00:00.000Z"),
      exerciseType: "걷기",
      intensity: "medium",
      startedAt: new Date("2026-08-20T09:00:00.000Z"),
      endedAt: new Date("2026-08-20T09:30:00.000Z"),
      averageHeartRate: 105,
      dailyLog: { localDate: "2026-08-20" },
    });
    prisma.wellnessEntry.findFirst.mockResolvedValue({
      id: "wellness-1",
      updatedAt: new Date("2026-08-20T12:00:00.000Z"),
      localDate: "2026-08-20",
      fatigueLevel: 2,
      stressLevel: 3,
    });
    prisma.exerciseEntry.count.mockResolvedValue(2);
    prisma.wellnessEntry.count.mockResolvedValue(2);

    const model = await getRecordHub(scope, { getPrisma: () => prisma });
    const exercise = model.categories.find((category) => category.type === "exercise");

    expect(exercise?.records).toEqual([{ recordId: "exercise-1", recordType: "exercise" }]);
    expect(exercise?.editDraft?.values).toMatchObject({
      exerciseRecordId: "exercise-1",
      wellnessRecordId: "wellness-1",
    });
    expect(exercise?.summary).toBe("마지막: 2026-08-20 · 저장 2건 · 컨디션 2건");
    expect(prisma.exerciseEntry.count).toHaveBeenCalledWith({ where: { userId: scope.userId } });
    expect(prisma.wellnessEntry.count).toHaveBeenCalledWith({ where: { userId: scope.userId } });
  });

  it("selects and restores an alcohol measurement unit in the edit draft", async () => {
    const prisma = emptyPrisma();
    prisma.alcoholEntry.findFirst.mockResolvedValue({
      id: "alcohol-1",
      updatedAt: new Date("2026-08-20T12:00:00.000Z"),
      alcoholType: "맥주",
      servings: 2,
      measurementUnit: "can",
      consumedAt: new Date("2026-08-20T20:00:00.000Z"),
      dailyLog: { localDate: "2026-08-20" },
    });
    prisma.alcoholEntry.count.mockResolvedValue(1);

    const model = await getRecordHub(scope, { getPrisma: () => prisma });
    const alcohol = model.categories.find((category) => category.type === "alcohol");

    expect(prisma.alcoholEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: scope.userId },
      select: expect.objectContaining({ measurementUnit: true }),
    }));
    expect(alcohol?.editDraft?.values).toMatchObject({
      recordId: "alcohol-1",
      alcoholType: "맥주",
      servings: "2",
      measurementUnit: "can",
    });
  });
});
