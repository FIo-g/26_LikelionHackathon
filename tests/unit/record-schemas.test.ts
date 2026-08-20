import { describe, expect, it } from "vitest";

import { parseCreateRecordInput } from "@/modules/records/domain/schemas";

const createClock = () => ({ now: () => new Date("2026-08-20T00:00:00.000Z") });

describe("record schemas", () => {
  it("rejects sleep records with end before start", () => {
    expect(() => parseCreateRecordInput(createClock(), {
      type: "sleep",
      startedAt: new Date("2026-08-19T07:00:00Z"),
      endedAt: new Date("2026-08-19T06:00:00Z"),
      morningFatigue: 3,
      timezone: "Asia/Seoul",
    })).toThrow("endedAt must be after startedAt");
  });

  it("rejects future timestamps outside 5 minute tolerance", () => {
    expect(() => parseCreateRecordInput(createClock(), {
      type: "caffeine",
      brand: "coffee",
      product: "latte",
      caffeineMg: 120,
      consumedAt: new Date("2026-08-20T00:06:01.000Z"),
      timezone: "Asia/Seoul",
    })).toThrow("Date must not be more than 5 minutes in the future");
  });

  it("rejects invalid timezone", () => {
    expect(() => parseCreateRecordInput(createClock(), {
      type: "meal",
      size: "small",
      eatenAt: new Date("2026-08-19T07:00:00Z"),
      notes: "snack",
      timezone: "Invalid/Zone",
    })).toThrow("Invalid timezone");
  });

  it("rejects too-long notes", () => {
    expect(() => parseCreateRecordInput(createClock(), {
      type: "meal",
      size: "medium",
      eatenAt: new Date("2026-08-19T07:00:00Z"),
      notes: "x".repeat(501),
      timezone: "Asia/Seoul",
    })).toThrow();
  });

  it("requires a known unit for new alcohol records", () => {
    const input = {
      type: "alcohol" as const,
      alcoholType: "맥주",
      servings: 1,
      measurementUnit: "can",
      consumedAt: new Date("2026-08-19T07:00:00Z"),
      timezone: "Asia/Seoul",
    };

    expect(parseCreateRecordInput(createClock(), input)).toMatchObject(input);
    expect(() => parseCreateRecordInput(createClock(), {
      ...input,
      measurementUnit: "cup",
    })).toThrow();
    expect(() => parseCreateRecordInput(createClock(), {
      ...input,
      measurementUnit: "",
    })).toThrow();
    expect(() => parseCreateRecordInput(createClock(), {
      type: "alcohol",
      alcoholType: input.alcoholType,
      servings: input.servings,
      consumedAt: input.consumedAt,
      timezone: input.timezone,
    })).toThrow();
  });

  it("accepts valid records", () => {
    expect(parseCreateRecordInput(createClock(), {
      type: "wellness",
      localDate: "2026-08-19",
      fatigueLevel: 3,
      stressLevel: 4,
      timezone: "Asia/Seoul",
    })).toMatchObject({
      type: "wellness",
      localDate: "2026-08-19",
      fatigueLevel: 3,
      stressLevel: 4,
      timezone: "Asia/Seoul",
    });
  });
});
