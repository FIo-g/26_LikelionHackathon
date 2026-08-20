"use server";

import { habitsSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveHabitsStep } from "@/modules/onboarding/application/save-habits-step";
import { redirect } from "next/navigation";

export async function submitHabitsAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ]));
  const parsed = habitsSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveHabitsStep(userId, parsed.data);
  redirect("/onboarding/profile");
}

