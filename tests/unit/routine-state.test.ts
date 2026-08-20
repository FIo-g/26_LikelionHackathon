import { describe, expect, it } from "vitest";
import { deriveRoutineTimeline } from "@/modules/care/domain/routine";

const routine = [
  { key: "meal-cutoff", label: "저녁 식사 마무리", scheduledAt: new Date("2026-08-19T12:00:00.000Z") },
  { key: "phone-wind-down", label: "폰 정리", scheduledAt: new Date("2026-08-19T13:00:00.000Z") },
  { key: "target-bed", label: "잠자리", scheduledAt: new Date("2026-08-19T14:00:00.000Z") },
] as const;

describe("deriveRoutineTimeline", () => {
  it("derives done, current, and upcoming without persisted display state", () => {
    expect(deriveRoutineTimeline(routine, new Set(["meal-cutoff"]), new Date("2026-08-19T13:30:00.000Z"))).toEqual([
      expect.objectContaining({ key: "meal-cutoff", status: "done" }),
      expect.objectContaining({ key: "phone-wind-down", status: "current" }),
      expect.objectContaining({ key: "target-bed", status: "upcoming" }),
    ]);
  });
});
