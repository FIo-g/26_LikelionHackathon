import { describe, expect, it } from "vitest";

import {
  createPlannerInputHash,
  generateScheduleProposal,
  type ScheduleContext,
} from "@/modules/planner/domain/generate-schedule-proposal";

const minuteOfDay = (instant: string, timezone: string): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
};

const minutesBetween = (left: string, right: string, timezone: string): number => {
  const difference = minuteOfDay(right, timezone) - minuteOfDay(left, timezone);
  return Math.abs(((difference + 720) % 1440) - 720);
};

const scheduleContextFixture: ScheduleContext = {
  timezone: "Asia/Seoul",
  goal: {
    targetBedTime: "23:00",
    targetWakeTime: "07:00",
    targetDurationMinutes: 480,
  },
  baseline: {
    id: "baseline-1",
    status: "current",
    result: {
      baselineBedMinuteOfDay: 1380,
      baselineWakeMinuteOfDay: 420,
      sampleCount: 7,
      confidence: "high",
    },
  },
  event: {
    id: "event-1",
    type: "travel",
    startsAt: "2026-09-12T00:00:00.000Z",
    desiredWakeAt: "2026-09-11T19:00:00.000Z",
  },
};

describe("generateScheduleProposal", () => {
  it("moves bed and wake targets by at most fifteen minutes per day", () => {
    const proposal = generateScheduleProposal(scheduleContextFixture);

    for (let index = 1; index < proposal.days.length; index += 1) {
      expect(minutesBetween(
        proposal.days[index - 1].targetBedAt,
        proposal.days[index].targetBedAt,
        scheduleContextFixture.timezone,
      )).toBeLessThanOrEqual(15);
      expect(minutesBetween(
        proposal.days[index - 1].targetWakeAt,
        proposal.days[index].targetWakeAt,
        scheduleContextFixture.timezone,
      )).toBeLessThanOrEqual(15);
    }
  });

  it("uses low confidence and a goal fallback without a valid baseline", () => {
    const result = generateScheduleProposal({
      ...scheduleContextFixture,
      baseline: null,
    });

    expect(result.confidence).toBe("low");
    expect(result.evidence.map((item) => item.code)).toContain("insufficient-history");
    expect(minuteOfDay(result.days[0].targetWakeAt, scheduleContextFixture.timezone)).toBe(420);
  });

  it("calculates the adjustment window from the goal wake rather than a baseline wake", () => {
    const proposal = generateScheduleProposal({
      ...scheduleContextFixture,
      baseline: {
        ...scheduleContextFixture.baseline!,
        result: {
          baselineBedMinuteOfDay: 0,
          baselineWakeMinuteOfDay: 480,
          sampleCount: 7,
          confidence: "high",
        },
      },
    });

    expect(proposal.adjustmentStartsOn).toBe("2026-08-31");
    expect(minuteOfDay(proposal.days[0].targetWakeAt, scheduleContextFixture.timezone)).toBe(420);
  });

  it("uses the earlier normal goal wake or two hours before the event when no desired wake is set", () => {
    const proposal = generateScheduleProposal({
      ...scheduleContextFixture,
      event: {
        ...scheduleContextFixture.event,
        startsAt: "2026-09-12T03:00:00.000Z",
        desiredWakeAt: null,
      },
    });

    expect(proposal.eventWakeAt).toBe("2026-09-11T22:00:00Z");
  });

  it("records a DST adjustment for generated recurring goal times", () => {
    const proposal = generateScheduleProposal({
      timezone: "America/New_York",
      goal: {
        targetBedTime: "22:30",
        targetWakeTime: "02:30",
        targetDurationMinutes: 480,
      },
      baseline: null,
      event: {
        id: "event-dst",
        type: "early-start",
        startsAt: "2026-03-08T15:00:00.000Z",
        desiredWakeAt: "2026-03-08T11:00:00.000Z",
      },
    });

    expect(proposal.evidence.map((item) => item.code)).toContain("dst-adjusted");
  });

  it("hashes calculation inputs from recursively canonical JSON", () => {
    const left = {
      schemaVersion: 1,
      timezone: "Asia/Seoul",
      goal: { targetWakeTime: "07:00", targetBedTime: "23:00", targetDurationMinutes: 480 },
      baselineId: null,
      event: null,
      planId: null,
      triggerRecordId: null,
    };
    const right = {
      triggerRecordId: null,
      planId: null,
      event: null,
      baselineId: null,
      goal: { targetDurationMinutes: 480, targetBedTime: "23:00", targetWakeTime: "07:00" },
      timezone: "Asia/Seoul",
      schemaVersion: 1,
    };

    expect(createPlannerInputHash(left)).toBe(createPlannerInputHash(right));
  });
});
