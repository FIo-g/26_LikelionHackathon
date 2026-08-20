import { profileUpdateSchema, sleepGoalSchema } from "@/modules/onboarding/domain/schemas";

export const accountProfileSchema = profileUpdateSchema;
export const accountSleepGoalSchema = sleepGoalSchema;

export type AccountActionState = Readonly<{
  status: "idle" | "success" | "error";
  values: Record<string, string>;
  fieldErrors: Record<string, readonly string[]>;
}>;

export const accountActionIdle: AccountActionState = { status: "idle", values: {}, fieldErrors: {} };

export type DeleteAccountActionState = Readonly<{ status: "idle" | "error"; error: string | null }>;
export const deleteAccountActionIdle: DeleteAccountActionState = { status: "idle", error: null };
