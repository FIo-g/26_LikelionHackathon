export type OnboardingStep = 1 | 2 | 3 | 4;

export type ConnectInput = Readonly<{
  selected: "manual";
}>;

export type SleepGoalInput = Readonly<{
  targetBedTime: string;
  targetWakeTime: string;
  targetDurationMinutes: number;
}>;

export type SleepGoalFormInput = Omit<SleepGoalInput, "targetDurationMinutes">;

export const PROFILE_GENDERS = ["female", "male", "nonbinary", "prefer-not-to-say"] as const;
export type ProfileGender = (typeof PROFILE_GENDERS)[number];

export const HABIT_ALCOHOL_FREQUENCIES = ["none", "monthly", "weekly", "frequent"] as const;
export type HabitAlcoholFrequency = (typeof HABIT_ALCOHOL_FREQUENCIES)[number];

export type HabitValues = Readonly<{
  caffeine: "none" | "sometimes" | "daily";
  exercise: "rare" | "weekly" | "frequent";
  meal: "early" | "mixed" | "late";
  /**
   * Optional at the application boundary so existing in-progress onboarding
   * forms can be resumed. Stored rows normalize an omitted value to null.
   */
  alcohol?: HabitAlcoholFrequency | null;
  phoneUsage: "low" | "medium" | "high";
}>;

export type ProfileDetails = Readonly<{
  nickname: string;
  timezone: string;
  age: number | null;
  gender: ProfileGender | null;
  heightCm: number | null;
  weightKg: number | null;
}>;

export type ProfileInput = Readonly<{
  nickname: string;
  timezone: string;
  /**
   * Optional at the mutation boundary for backwards compatibility with
   * profiles saved before these additive columns existed.
   */
  age?: number | null;
  gender?: ProfileGender | null;
  heightCm?: number | null;
  weightKg?: number | null;
}>;

export type OnboardingProgressData = Readonly<{
  connect: ConnectInput | null;
  sleepGoal: SleepGoalInput | null;
  habits: HabitValues | null;
  profile: ProfileDetails | null;
}>;

export const ONBOARDING_STEP_COUNT = 4;
