"use server";

import { sleepGoalSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveSleepGoalStep } from "@/modules/onboarding/application/save-sleep-goal-step";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { redirect } from "next/navigation";
import { readOnboardingFormValues } from "../form-values";
import { redirectIfOnboardingPrerequisiteIsMissing } from "../flow";

export async function submitSleepGoalAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();
  const progress = await createOnboardingRepository(userId).getProgress();
  redirectIfOnboardingPrerequisiteIsMissing(progress, "sleep-goal");

  const values = readOnboardingFormValues(formData);
  const parsed = sleepGoalSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveSleepGoalStep(userId, parsed.data);
  redirect("/onboarding/connect");
}
