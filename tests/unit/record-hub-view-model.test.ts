import { describe, expect, it, vi } from "vitest";

import { getRecordHub } from "@/modules/records/application/get-record-hub";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };

type RecordRow = { id: string; updatedAt: Date; [key: string]: unknown };

const emptyFindFirst = () => vi.fn(async (): Promise<RecordRow | null> => null);

const emptyPrisma = () => ({
  caffeineEntry: { findFirst: emptyFindFirst() },
  alcoholEntry: { findFirst: emptyFindFirst() },
  mealEntry: { findFirst: emptyFindFirst() },
  exerciseEntry: { findFirst: emptyFindFirst() },
  wellnessEntry: { findFirst: emptyFindFirst() },
  sleepSession: { findFirst: emptyFindFirst() },
  phoneUsageEntry: { findFirst: emptyFindFirst() },
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
    });
    prisma.wellnessEntry.findFirst.mockResolvedValue({
      id: "wellness-1",
      updatedAt: new Date("2026-08-20T12:00:00.000Z"),
      localDate: "2026-08-20",
      fatigueLevel: 2,
      stressLevel: 3,
    });

    const model = await getRecordHub(scope, { getPrisma: () => prisma });
    const exercise = model.categories.find((category) => category.type === "exercise");

    expect(exercise?.records).toEqual([{ recordId: "exercise-1", recordType: "exercise" }]);
    expect(exercise?.editDraft?.values).toMatchObject({
      exerciseRecordId: "exercise-1",
      wellnessRecordId: "wellness-1",
    });
  });
});
