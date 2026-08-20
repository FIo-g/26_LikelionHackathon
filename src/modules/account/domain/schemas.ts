import { profileSchema, sleepGoalSchema } from "@/modules/onboarding/domain/schemas";

export const accountProfileSchema = profileSchema;
export const accountSleepGoalSchema = sleepGoalSchema;

export type AccountActionState = Readonly<{
  status: "idle" | "success" | "error";
  values: Record<string, string>;
  fieldErrors: Record<string, readonly string[]>;
}>;

export const accountActionIdle: AccountActionState = { status: "idle", values: {}, fieldErrors: {} };
