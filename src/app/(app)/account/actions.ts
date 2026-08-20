"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createDeleteUserAccount } from "@/modules/account/application/delete-user-account";
import { readSensitiveActionSession } from "@/modules/account/application/require-recent-authentication";
import { createUpdateProfileService } from "@/modules/account/application/update-profile";
import { createUpdateSleepGoalService } from "@/modules/account/application/update-sleep-goal";
import { accountActionIdle, accountProfileSchema, accountSleepGoalSchema, type AccountActionState } from "@/modules/account/domain/schemas";
import { assertTrustedMutationOrigin } from "@/modules/account/domain/export-schema";
import { AUTH_SESSION_COOKIE } from "@/shared/auth/auth";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import { getPrismaClient } from "@/shared/db/prisma";
import { systemClock } from "@/shared/time/system-clock";

const valuesFor = (formData: FormData): Record<string, string> => Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
const errorState = (formData: FormData, fieldErrors: Record<string, readonly string[]>): AccountActionState => ({ status: "error", values: valuesFor(formData), fieldErrors });
const successState = (formData: FormData): AccountActionState => ({ status: "success", values: valuesFor(formData), fieldErrors: {} });
const revalidateAccount = () => { revalidatePath("/account"); revalidatePath("/today"); revalidatePath("/analyze"); revalidatePath("/plan"); revalidatePath("/care"); };

export type DeleteAccountActionState = Readonly<{ status: "idle" | "error"; error: string | null }>;
export const deleteAccountActionIdle: DeleteAccountActionState = { status: "idle", error: null };

export async function updateProfileAction(_previousState: AccountActionState = accountActionIdle, formData: FormData): Promise<AccountActionState> {
  const values = valuesFor(formData);
  const parsed = accountProfileSchema.safeParse({ nickname: values.nickname, timezone: values.timezone });
  if (!parsed.success) return errorState(formData, parsed.error.flatten().fieldErrors as Record<string, readonly string[]>);
  try {
    const scope = await requireUserScope();
    await createUpdateProfileService(scope).update(parsed.data);
    revalidateAccount();
    return successState(formData);
  } catch {
    return errorState(formData, { _form: ["개인 정보를 저장하지 못했어요."] });
  }
}

export async function updateSleepGoalAction(_previousState: AccountActionState = accountActionIdle, formData: FormData): Promise<AccountActionState> {
  const values = valuesFor(formData);
  const parsed = accountSleepGoalSchema.safeParse({ targetBedTime: values.targetBedTime, targetWakeTime: values.targetWakeTime });
  if (!parsed.success) return errorState(formData, parsed.error.flatten().fieldErrors as Record<string, readonly string[]>);
  try {
    const scope = await requireUserScope();
    await createUpdateSleepGoalService(scope).update(parsed.data);
    revalidateAccount();
    return successState(formData);
  } catch {
    return errorState(formData, { _form: ["수면 목표를 저장하지 못했어요."] });
  }
}

export async function deleteUserAccountAction(_previousState: DeleteAccountActionState = deleteAccountActionIdle, formData: FormData): Promise<DeleteAccountActionState> {
  try {
    const requestHeaders = new Headers(await headers());
    assertTrustedMutationOrigin(requestHeaders.get("origin"));
    const session = await readSensitiveActionSession(requestHeaders);
    if (!session) return { status: "error", error: "계정을 삭제하려면 다시 로그인해 주세요." };
    const scope = await requireUserScope();
    if (scope.userId !== session.userId) return { status: "error", error: "계정을 삭제할 수 없어요. 다시 로그인해 주세요." };
    const confirmationEmail = typeof formData.get("confirmationEmail") === "string" ? String(formData.get("confirmationEmail")) : "";
    const confirmationPhrase = typeof formData.get("confirmationPhrase") === "string" ? String(formData.get("confirmationPhrase")) : "";
    if (confirmationPhrase !== "계정 삭제") return { status: "error", error: "삭제 확인 문구를 정확히 입력해 주세요." };
    const password = formData.get("password");
    await createDeleteUserAccount({ prisma: getPrismaClient(), clock: systemClock })({
      password: typeof password === "string" && password ? password : null,
      confirmationEmail,
      confirmationPhrase,
    }, { scope, session, requestHeaders });
  } catch {
    return { status: "error", error: "계정을 삭제하지 못했어요. 본인 확인 정보를 확인한 뒤 다시 시도해 주세요." };
  }

  (await cookies()).delete(AUTH_SESSION_COOKIE);
  redirect("/sign-in?deleted=1");
}
