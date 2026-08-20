"use server";

import { profileSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { completeOnboarding } from "@/modules/onboarding/application/complete-onboarding";
import { redirect } from "next/navigation";

export async function submitProfileAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ]));
  const parsed = profileSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await completeOnboarding(userId, parsed.data);
  redirect("/today");
}

