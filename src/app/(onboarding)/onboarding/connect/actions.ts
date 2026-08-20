"use server";

import { connectSchema } from "@/modules/onboarding/domain/schemas";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveConnectStep } from "@/modules/onboarding/application/save-connect-step";
import { redirect } from "next/navigation";

export async function submitConnectAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();

  const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ]));
  const parsed = connectSchema.safeParse(values);

  if (!parsed.success) {
    return;
  }

  await saveConnectStep(userId, parsed.data);
  redirect("/onboarding/sleep-goal");
}

