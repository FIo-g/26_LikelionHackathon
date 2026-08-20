import { describe, expect, it } from "vitest";

import {
  formatRecordWallTime,
  formatRecordWallTimeInput,
  parseRecordWallTime,
  parseZonedDateTime,
  possibleOffsetsForWallTime,
} from "@/shared/time/zoned-date-time";
import { wakeLocalDate } from "@/shared/time/local-date";

describe("zoned-date-time", () => {
  it("rejects a nonexistent DST wall time", () => {
    expect(() => parseZonedDateTime({
      localDate: "2026-03-08",
      localTime: "02:30",
      timezone: "America/New_York",
    })).toThrow("NONEXISTENT_OR_AMBIGUOUS_TIME");
  });

  it("accepts an explicit offset in a repeated DST hour", () => {
    const parsed = parseZonedDateTime({
      localDate: "2026-11-01",
      localTime: "01:30",
      timezone: "America/New_York",
      offsetMinutes: -300,
    });

    expect(parsed.toISOString()).toBe("2026-11-01T06:30:00.000Z");
  });

  it("lists possible UTC offsets for ambiguous wall time", () => {
    expect(possibleOffsetsForWallTime({
      localDate: "2026-11-01",
      localTime: "01:30",
      timezone: "America/New_York",
    })).toHaveLength(2);
  });

  it("returns local date of UTC instant in target timezone", () => {
    expect(wakeLocalDate(new Date("2026-11-01T00:30:00.000Z"), "Asia/Seoul")).toBe("2026-11-01");
  });

  it("rejects a DST gap in the stored timezone", () => {
    expect(() => parseRecordWallTime("2026-03-08T02:30", "America/New_York"))
      .toThrow("NONEXISTENT_LOCAL_TIME");
  });

  it("requires explicit disambiguation for a repeated wall time", () => {
    expect(() => parseRecordWallTime("2026-11-01T01:30", "America/New_York"))
      .toThrow("AMBIGUOUS_LOCAL_TIME");
  });

  it("round-trips a chosen repeated wall time through the stored timezone", () => {
    const parsed = parseRecordWallTime(
      { value: "2026-11-01T01:30", disambiguation: "later" },
      "America/New_York",
    );

    expect(parsed.toISOString()).toBe("2026-11-01T06:30:00.000Z");
    expect(formatRecordWallTime(parsed, "America/New_York")).toBe("2026-11-01T01:30");
  });

  it("preserves the later occurrence when formatting a repeated instant for editing", () => {
    expect(formatRecordWallTimeInput(
      new Date("2026-11-01T06:30:00.000Z"),
      "America/New_York",
    )).toEqual({
      value: "2026-11-01T01:30",
      disambiguation: "later",
    });
  });
});
