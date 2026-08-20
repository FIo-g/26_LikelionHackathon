import { describe, expect, it } from "vitest";

import { generateRerouteProposal } from "@/modules/planner/domain/generate-reroute-proposal";

const target = (localDate: string, bedAt: string) => ({
  id: `day-${localDate}`,
  planId: "plan-1",
  localDate,
  targetBedAt: bedAt,
  targetWakeAt: new Date(new Date(bedAt).getTime() + 8 * 60 * 60 * 1000).toISOString(),
  caffeineCutoffAt: new Date(new Date(bedAt).getTime() - 7 * 60 * 60 * 1000).toISOString(),
  exerciseCutoffAt: new Date(new Date(bedAt).getTime() - 4 * 60 * 60 * 1000).toISOString(),
  mealCutoffAt: new Date(new Date(bedAt).getTime() - 3 * 60 * 60 * 1000).toISOString(),
  windDownAt: new Date(new Date(bedAt).getTime() - 60 * 60 * 1000).toISOString(),
  status: "active" as const,
});

describe("generateRerouteProposal", () => {
  it("reroutes only active days after the trigger instant", () => {
    const result = generateRerouteProposal({
      timezone: "Asia/Seoul",
      goal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
      baseline: null,
      trigger: {
        recordId: "caffeine-1",
        input: {
          type: "caffeine",
          brand: "테스트",
          product: "커피",
          caffeineMg: 120,
          consumedAt: new Date("2026-08-22T14:30:00.000Z"),
          timezone: "Asia/Seoul",
        },
      },
      activeDays: [
        target("2026-08-21", "2026-08-21T14:00:00.000Z"),
        target("2026-08-22", "2026-08-22T15:00:00.000Z"),
        target("2026-08-23", "2026-08-23T15:00:00.000Z"),
      ],
      now: new Date("2026-08-22T14:00:00.000Z"),
    });

    expect(result?.days.map((day) => day.localDate)).toEqual(["2026-08-22", "2026-08-23"]);
    expect(result?.days[0]?.targetBedAt).toBe("2026-08-22T15:15:00.000Z");
  });

  it("does not propose a reroute when a caffeine entry is before its active-day cutoff", () => {
    const result = generateRerouteProposal({
      timezone: "Asia/Seoul",
      goal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
      baseline: null,
      trigger: {
        recordId: "caffeine-1",
        input: {
          type: "caffeine",
          brand: "테스트",
          product: "커피",
          caffeineMg: 120,
          consumedAt: new Date("2026-08-22T07:00:00.000Z"),
          timezone: "Asia/Seoul",
        },
      },
      activeDays: [target("2026-08-22", "2026-08-22T15:00:00.000Z")],
      now: new Date("2026-08-22T06:00:00.000Z"),
    });

    expect(result).toBeNull();
  });

  it("does not derive a conflict from a plan day whose target bedtime is before the trigger instant", () => {
    const result = generateRerouteProposal({
      timezone: "Asia/Seoul",
      goal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
      baseline: null,
      trigger: {
        recordId: "caffeine-1",
        input: {
          type: "caffeine",
          brand: "테스트",
          product: "커피",
          caffeineMg: 120,
          consumedAt: new Date("2026-08-22T14:30:00.000Z"),
          timezone: "Asia/Seoul",
        },
      },
      activeDays: [
        target("2026-08-22", "2026-08-22T14:15:00.000Z"),
        target("2026-08-23", "2026-08-23T15:00:00.000Z"),
      ],
      now: new Date("2026-08-22T14:00:00.000Z"),
    });

    expect(result).toBeNull();
  });

  it("does not derive a conflict from completed or superseded plan days", () => {
    const result = generateRerouteProposal({
      timezone: "Asia/Seoul",
      goal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
      baseline: null,
      trigger: {
        recordId: "caffeine-1",
        input: {
          type: "caffeine",
          brand: "테스트",
          product: "커피",
          caffeineMg: 120,
          consumedAt: new Date("2026-08-22T12:30:00.000Z"),
          timezone: "Asia/Seoul",
        },
      },
      activeDays: [
        { ...target("2026-08-22", "2026-08-22T15:00:00.000Z"), status: "completed" },
        { ...target("2026-08-23", "2026-08-23T15:00:00.000Z"), status: "superseded" },
        target("2026-08-24", "2026-08-24T15:00:00.000Z"),
      ],
      now: new Date("2026-08-22T10:00:00.000Z"),
    });

    expect(result).toBeNull();
  });
});
