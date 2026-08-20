import { describe, expect, it } from "vitest";

import {
  calculateSleepDurationMinutes,
} from "@/modules/onboarding/domain/calculate-sleep-duration";
import {
  connectSchema,
  habitsSchema,
  profileSchema,
  sleepGoalSchema,
} from "@/modules/onboarding/domain/schemas";

describe("onboarding domain validation", () => {
  it("calculates wrapped sleep duration", () => {
    expect(calculateSleepDurationMinutes({ targetBedTime: "23:30", targetWakeTime: "07:00" })).toBe(450);
  });

  it("rejects identical sleep goal times", () => {
    expect(sleepGoalSchema.safeParse({
      targetBedTime: "23:00",
      targetWakeTime: "23:00",
    }).success).toBe(false);
  });

  it("enforces connection selection", () => {
    expect(connectSchema.safeParse({ selected: "automatic" }).success).toBe(false);
    expect(connectSchema.safeParse({ selected: "manual" }).success).toBe(true);
  });

  it("normalizes and validates onboarding profile", () => {
    expect(profileSchema.safeParse({
      nickname: "  사용자  ",
      timezone: "Asia/Seoul",
    }).success).toBe(true);

    expect(profileSchema.safeParse({
      nickname: "",
      timezone: "Asia/Seoul",
    }).success).toBe(false);

    expect(profileSchema.safeParse({
      nickname: "tester",
      timezone: "Invalid/Zone",
    }).success).toBe(false);
  });

  it("validates habits schema", () => {
    expect(habitsSchema.safeParse({
      caffeine: "daily",
      exercise: "rare",
      meal: "early",
      phoneUsage: "low",
    }).success).toBe(true);

    expect(habitsSchema.safeParse({
      caffeine: "never",
      exercise: "rare",
      meal: "early",
      phoneUsage: "low",
    }).success).toBe(false);
  });
});

