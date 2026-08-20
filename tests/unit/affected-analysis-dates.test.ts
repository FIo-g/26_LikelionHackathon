import { describe, expect, it } from "vitest";

import { affectedAnalysisDates } from "@/modules/records/application/affected-analysis-dates";

describe("affectedAnalysisDates", () => {
  it("returns up to 14 rolling analysis dates", () => {
    expect(affectedAnalysisDates("2026-08-01", "2026-08-19")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("returns only one date for single day ranges", () => {
    expect(affectedAnalysisDates("2026-08-01", "2026-08-01")).toEqual(["2026-08-01"]);
  });

  it("throws on invalid local date strings", () => {
    expect(() => affectedAnalysisDates("2026-99-99")).toThrow("INVALID_LOCAL_DATE");
  });
});
