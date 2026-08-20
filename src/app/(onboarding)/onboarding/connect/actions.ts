"use server";

import { connectSchema } from "@/modules/onboarding/domain/schemas";
import { actionError } from "@/modules/onboarding/application/ports";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { saveConnectStep } from "@/modules/onboarding/application/save-connect-step";
import { redirect } from "next/navigation";

export async function submitConnectAction(
  previousState: ReturnType<typeof actionError>,
  formData: FormData,
) {
  const userId = await requireSessionUserId();

  const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ]));
  const parsed = connectSchema.safeParse(values);

  if (!parsed.success) {
    return actionError(previousState, formData, parsed.error.flatten().fieldErrors);
  }

  await saveConnectStep(userId, parsed.data);
  redirect("/onboarding/sleep-goal");
}

