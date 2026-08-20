import { describe, expect, it } from "vitest";

import {
  calculateSleepDurationMinutes,
} from "@/modules/onboarding/domain/calculate-sleep-duration";
import {
  connectSchema,
  habitsSchema,
  profileSchema,
  profileUpdateSchema,
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
    expect(profileSchema.parse({
      nickname: "  사용자  ",
      timezone: "Asia/Seoul",
      age: "26",
      gender: "female",
      heightCm: "165",
      weightKg: "54.5",
    })).toMatchObject({
      nickname: "사용자",
      age: 26,
      gender: "female",
      heightCm: 165,
      weightKg: 54.5,
    });

    expect(profileSchema.parse({
      nickname: "사용자",
      timezone: "Asia/Seoul",
    })).toMatchObject({
      age: null,
      gender: null,
      heightCm: null,
      weightKg: null,
    });

    expect(profileSchema.safeParse({
      nickname: "",
      timezone: "Asia/Seoul",
    }).success).toBe(false);

    expect(profileSchema.safeParse({
      nickname: "tester",
      timezone: "Invalid/Zone",
    }).success).toBe(false);

    expect(profileSchema.safeParse({
      nickname: "tester",
      timezone: "Asia/Seoul",
      age: "0",
      gender: "unknown",
      heightCm: "20",
      weightKg: "501",
    }).success).toBe(false);
  });

  it("validates habits schema", () => {
    expect(habitsSchema.safeParse({
      caffeine: "daily",
      exercise: "rare",
      meal: "early",
      alcohol: "monthly",
      phoneUsage: "low",
    }).success).toBe(true);

    expect(habitsSchema.parse({
      caffeine: "daily",
      exercise: "rare",
      meal: "early",
      phoneUsage: "low",
    }).alcohol).toBeNull();

    expect(habitsSchema.safeParse({
      caffeine: "never",
      exercise: "rare",
      meal: "early",
      alcohol: "monthly",
      phoneUsage: "low",
    }).success).toBe(false);
  });

  it("keeps absent Account profile fields absent while treating explicit blanks as null", () => {
    const omitted = profileUpdateSchema.parse({
      nickname: "사용자",
      timezone: "Asia/Seoul",
    });
    expect(omitted).toMatchObject({
      nickname: "사용자",
      timezone: "Asia/Seoul",
    });
    expect(omitted).not.toHaveProperty("age");
    expect(omitted).not.toHaveProperty("gender");
    expect(omitted).not.toHaveProperty("heightCm");
    expect(omitted).not.toHaveProperty("weightKg");

    expect(profileUpdateSchema.parse({
      nickname: "사용자",
      timezone: "Asia/Seoul",
      age: "",
      gender: "",
      heightCm: "",
      weightKg: "",
    })).toMatchObject({
      age: null,
      gender: null,
      heightCm: null,
      weightKg: null,
    });
  });
});
