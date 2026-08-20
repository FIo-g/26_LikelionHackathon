import { describe, expect, it } from "vitest";

import { parseUnambiguousLocalEventTime } from "@/modules/planner/application/parse-local-event-time";

describe("parse unambiguous local event time", () => {
  it("rejects an ambiguous fall-back local time instead of selecting an offset", () => {
    expect(() => parseUnambiguousLocalEventTime("2026-11-01T01:30", "America/New_York")).toThrow("AMBIGUOUS_LOCAL_TIME");
  });

  it("rejects a nonexistent spring-forward local time instead of shifting it", () => {
    expect(() => parseUnambiguousLocalEventTime("2026-03-08T02:30", "America/New_York")).toThrow("NONEXISTENT_LOCAL_TIME");
  });
});
