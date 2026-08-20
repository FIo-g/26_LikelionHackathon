"use server";

import { profileSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { completeOnboarding } from "@/modules/onboarding/application/complete-onboarding";
import { redirect } from "next/navigation";
import { readOnboardingFormValues } from "../form-values";

export async function submitProfileAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = readOnboardingFormValues(formData);
  const parsed = profileSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  try {
    await completeOnboarding(userId, parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "INCOMPLETE_ONBOARDING") {
      redirect("/onboarding/connect");
    }

    throw error;
  }

  redirect("/today");
}
