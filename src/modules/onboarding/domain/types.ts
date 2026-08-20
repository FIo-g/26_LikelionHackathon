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

export type HabitValues = Readonly<{
  caffeine: "none" | "sometimes" | "daily";
  exercise: "rare" | "weekly" | "frequent";
  meal: "early" | "mixed" | "late";
  phoneUsage: "low" | "medium" | "high";
}>;

export type ProfileInput = Readonly<{
  nickname: string;
  timezone: string;
}>;

export type OnboardingProgressData = Readonly<{
  connect: ConnectInput | null;
  sleepGoal: SleepGoalInput | null;
  habits: HabitValues | null;
  profile: ProfileInput | null;
}>;

export const ONBOARDING_STEP_COUNT = 4;

