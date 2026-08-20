"use server";

import { sleepGoalSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveSleepGoalStep } from "@/modules/onboarding/application/save-sleep-goal-step";
import { redirect } from "next/navigation";

export async function submitSleepGoalAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ]));
  const parsed = sleepGoalSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveSleepGoalStep(userId, parsed.data);
  redirect("/onboarding/habits");
}
