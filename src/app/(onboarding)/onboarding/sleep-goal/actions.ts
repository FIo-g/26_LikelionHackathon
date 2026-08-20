"use server";

import { sleepGoalSchema } from "@/modules/onboarding/domain/schemas";
import { actionError } from "@/modules/onboarding/application/ports";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveSleepGoalStep } from "@/modules/onboarding/application/save-sleep-goal-step";
import { redirect } from "next/navigation";

export async function submitSleepGoalAction(
  previousState: ReturnType<typeof actionError>,
  formData: FormData,
) {
  const userId = await requireSessionUserId();

  const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ]));
  const parsed = sleepGoalSchema.safeParse(values);

  if (!parsed.success) {
    return actionError(previousState, formData, parsed.error.flatten().fieldErrors);
  }

  await saveSleepGoalStep(userId, parsed.data);
  redirect("/onboarding/habits");
}
