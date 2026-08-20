"use server";

import { habitsSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveHabitsStep } from "@/modules/onboarding/application/save-habits-step";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { redirect } from "next/navigation";
import { readOnboardingFormValues } from "../form-values";
import { redirectIfOnboardingPrerequisiteIsMissing } from "../flow";

export async function submitHabitsAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();
  const progress = await createOnboardingRepository(userId).getProgress();
  redirectIfOnboardingPrerequisiteIsMissing(progress, "habits");

  const values = readOnboardingFormValues(formData);
  const parsed = habitsSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveHabitsStep(userId, parsed.data);
  redirect("/onboarding/sleep-goal");
}
