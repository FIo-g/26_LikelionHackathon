"use server";

import { habitsSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveHabitsStep } from "@/modules/onboarding/application/save-habits-step";
import { redirect } from "next/navigation";
import { readOnboardingFormValues } from "../form-values";

export async function submitHabitsAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = readOnboardingFormValues(formData);
  const parsed = habitsSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveHabitsStep(userId, parsed.data);
  redirect("/onboarding/profile");
}
