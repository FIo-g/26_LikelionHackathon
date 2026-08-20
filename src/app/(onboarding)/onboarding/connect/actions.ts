"use server";

import { connectSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveConnectStep } from "@/modules/onboarding/application/save-connect-step";
import { completeOnboarding } from "@/modules/onboarding/application/complete-onboarding";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { redirect } from "next/navigation";
import { readOnboardingFormValues } from "../form-values";
import { firstMissingPrerequisitePath, redirectIfOnboardingPrerequisiteIsMissing } from "../flow";

export async function submitConnectAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();
  redirectIfOnboardingPrerequisiteIsMissing(progress, "connect");

  const values = readOnboardingFormValues(formData);
  const parsed = connectSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveConnectStep(userId, parsed.data);

  let onboardingStillIncomplete = false;
  try {
    await completeOnboarding(userId);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "INCOMPLETE_ONBOARDING") {
      throw error;
    }
    onboardingStillIncomplete = true;
  }

  if (onboardingStillIncomplete) {
    const refreshedProgress = await repository.getProgress();
    redirect(firstMissingPrerequisitePath(refreshedProgress, "connect") ?? "/onboarding/profile");
  }

  redirect("/today");
}
