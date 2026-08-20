"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCompleteRoutineStepService } from "@/modules/care/application/complete-routine-step";
import { createUndoRoutineStepService } from "@/modules/care/application/undo-routine-step";
import { createStartCareToolService } from "@/modules/care/application/start-care-tool";
import { createCompleteCareToolService } from "@/modules/care/application/complete-care-tool";
import { CARE_TOOL_CATALOG } from "@/modules/care/domain/tool-catalog";
import { requireUserScope } from "@/shared/auth/require-user-scope";

const stepSchema = z.enum(["caffeine-cutoff", "exercise-cutoff", "meal-cutoff", "phone-wind-down", "target-bed"]);
const toolSchema = z.enum(CARE_TOOL_CATALOG.map((tool) => tool.key) as ["breathing", "white-noise", "sleep-guide"]);

const actionId = () => crypto.randomUUID();

export async function completeRoutineStepAction(input: { localDate: string; planDayId: string | null; routineRevisionKey: string; stepKey: string }): Promise<{ ok: boolean; message?: string }> {
  const parsed = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), planDayId: z.string().min(1).nullable(), routineRevisionKey: z.string().min(1), stepKey: stepSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "루틴 단계를 확인해 주세요." };
  try {
    const scope = await requireUserScope();
    await createCompleteRoutineStepService(scope).complete({ ...parsed.data, idempotencyKey: actionId() });
    revalidatePath("/care");
    return { ok: true };
  } catch { return { ok: false, message: "루틴을 완료하지 못했어요." }; }
}

export async function undoRoutineStepAction(input: { localDate: string; planDayId: string | null; routineRevisionKey: string; stepKey: string }): Promise<{ ok: boolean; message?: string }> {
  const parsed = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), planDayId: z.string().min(1).nullable(), routineRevisionKey: z.string().min(1), stepKey: stepSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "루틴 단계를 확인해 주세요." };
  try {
    const scope = await requireUserScope();
    await createUndoRoutineStepService(scope).undo({ ...parsed.data, idempotencyKey: actionId() });
    revalidatePath("/care");
    return { ok: true };
  } catch { return { ok: false, message: "오늘 루틴만 되돌릴 수 있어요." }; }
}

export async function startCareToolAction(input: { localDate: string; toolKey: string; plannedDurationSeconds: number }): Promise<{ ok: boolean; sessionId?: string; message?: string }> {
  const parsed = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), toolKey: toolSchema, plannedDurationSeconds: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "도구를 시작하지 못했어요." };
  try {
    const scope = await requireUserScope();
    const session = await createStartCareToolService(scope).start({ ...parsed.data, idempotencyKey: actionId() });
    return { ok: true, sessionId: session.sessionId };
  } catch { return { ok: false, message: "도구를 시작하지 못했어요." }; }
}

export async function completeCareToolAction(input: { sessionId: string }): Promise<{ ok: boolean; message?: string }> {
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "완료 세션을 확인할 수 없어요." };
  try {
    const scope = await requireUserScope();
    await createCompleteCareToolService(scope).complete({ sessionId: parsed.data.sessionId, idempotencyKey: actionId() });
    return { ok: true };
  } catch { return { ok: false, message: "완료 기록을 저장하지 못했어요." }; }
}
