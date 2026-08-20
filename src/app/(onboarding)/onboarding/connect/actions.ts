"use server";

import { connectSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveConnectStep } from "@/modules/onboarding/application/save-connect-step";
import { redirect } from "next/navigation";
import { readOnboardingFormValues } from "../form-values";

export async function submitConnectAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = readOnboardingFormValues(formData);
  const parsed = connectSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveConnectStep(userId, parsed.data);
  redirect("/onboarding/sleep-goal");
}
