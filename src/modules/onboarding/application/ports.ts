import type {
  ConnectInput,
  HabitValues,
  OnboardingProgressData,
  ProfileInput,
  SleepGoalInput,
  SleepGoalFormInput,
} from "../domain/types";

export interface OnboardingRepository {
  saveConnect(input: ConnectInput): Promise<void>;
  saveSleepGoal(input: SleepGoalInput): Promise<void>;
  replaceHabits(input: HabitValues): Promise<void>;
  complete(input: ProfileInput): Promise<void>;
  getProgress(): Promise<OnboardingProgressData>;
}

export type OnboardingActionState =
  | { status: "idle"; values: Record<string, string> }
  | {
    status: "error";
    values: Record<string, string>;
    fieldErrors: Record<string, readonly string[]>;
  }
  | { status: "success"; values: Record<string, string> };

export const actionError = (
  _previousState: OnboardingActionState,
  formData: FormData,
  fieldErrors: Record<string, readonly string[]>,
): OnboardingActionState => ({
  status: "error",
  values: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ])) as Record<string, string>,
  fieldErrors,
});

export const actionSuccess = (values: Record<string, string>): OnboardingActionState => ({
  status: "success",
  values,
});

export const normalizeSleepGoalInput = (input: SleepGoalFormInput): SleepGoalInput => ({
  targetBedTime: input.targetBedTime,
  targetWakeTime: input.targetWakeTime,
  targetDurationMinutes: 0,
});

