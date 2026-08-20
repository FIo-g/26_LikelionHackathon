import { describe, expect, it } from "vitest";

import { diffScheduleProposal } from "@/modules/planner/domain/diff-schedule-proposal";
import type { PlanDayTarget } from "@/modules/planner/domain/types";

const target = (localDate: string, time: string): PlanDayTarget => ({
  localDate,
  targetBedAt: `2026-08-20T${time}:00.000Z`,
  targetWakeAt: `2026-08-21T${time}:00.000Z`,
  caffeineCutoffAt: `2026-08-20T${time}:00.000Z`,
  exerciseCutoffAt: `2026-08-20T${time}:00.000Z`,
  mealCutoffAt: `2026-08-20T${time}:00.000Z`,
  windDownAt: `2026-08-20T${time}:00.000Z`,
});

describe("diffScheduleProposal", () => {
  it("returns only changed dates with before and after targets", () => {
    const currentDays = [
      target("2026-08-20", "14:30"),
      target("2026-08-21", "14:30"),
    ];
    const proposedDays = [
      target("2026-08-20", "14:30"),
      target("2026-08-21", "14:15"),
    ];

    expect(diffScheduleProposal(currentDays, proposedDays)).toMatchObject([
      {
        localDate: "2026-08-21",
        before: { targetBedAt: "2026-08-20T14:30:00.000Z", targetWakeAt: "2026-08-21T14:30:00.000Z" },
        after: { targetBedAt: "2026-08-20T14:15:00.000Z", targetWakeAt: "2026-08-21T14:15:00.000Z" },
      },
    ]);
  });

  it("marks a proposed date without an active target as newly created", () => {
    const proposed = target("2026-08-22", "14:15");

    expect(diffScheduleProposal([], [proposed])).toEqual([
      { localDate: "2026-08-22", before: null, after: proposed },
    ]);
  });
});
