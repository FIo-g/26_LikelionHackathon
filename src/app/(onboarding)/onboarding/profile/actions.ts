"use server";

import { profileSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveProfileStep } from "@/modules/onboarding/application/save-profile-step";
import { redirect } from "next/navigation";
import { readOnboardingFormValues } from "../form-values";

export async function submitProfileAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = readOnboardingFormValues(formData);
  const parsed = profileSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveProfileStep(userId, parsed.data);
  redirect("/onboarding/habits");
}
