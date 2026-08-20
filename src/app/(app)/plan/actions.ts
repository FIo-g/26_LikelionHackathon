"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createScheduleAdviceService } from "@/modules/planner/application/create-schedule-advice";
import { createAcceptScheduleAdviceService } from "@/modules/planner/application/accept-schedule-advice";
import { parseUnambiguousLocalEventTime } from "@/modules/planner/application/parse-local-event-time";
import type { RecordActionState } from "@/modules/records/application/record-service";
import { requireUserScope } from "@/shared/auth/require-user-scope";

const eventSchema = z.object({ idempotencyKey: z.string().uuid(), title: z.string().trim().min(1).max(100), type: z.string().trim().min(1).max(40), startsAt: z.string().min(1), desiredWakeAt: z.string(), notes: z.string().max(500) });

const actionError = (formData: FormData, fieldErrors: Record<string, readonly string[]>): RecordActionState => ({
  status: "error",
  values: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)])),
  fieldErrors: fieldErrors as Record<string, string[]>,
});

const revalidatePlan = (): void => { revalidatePath("/plan"); revalidatePath("/today"); revalidatePath("/analyze"); revalidatePath("/care"); };

export async function createMajorEventAction(formData: FormData): Promise<RecordActionState> {
  const scope = await requireUserScope();
  const parsed = eventSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return actionError(formData, parsed.error.flatten().fieldErrors);

  try {
    const result = await createScheduleAdviceService(scope).createScheduleAdvice({
      idempotencyKey: parsed.data.idempotencyKey,
      title: parsed.data.title,
      type: parsed.data.type,
      startsAt: parseUnambiguousLocalEventTime(parsed.data.startsAt, scope.timezone),
      desiredWakeAt: parsed.data.desiredWakeAt.trim() ? parseUnambiguousLocalEventTime(parsed.data.desiredWakeAt, scope.timezone) : null,
      notes: parsed.data.notes.trim() ? parsed.data.notes : null,
    });
    revalidatePlan();
    return { status: "success", recordId: result.eventId };
  } catch (error) {
    return actionError(formData, { _form: [String((error as Error).message ?? "Failed")] });
  }
}

export async function acceptScheduleAdviceAction(input: { adviceId: string; idempotencyKey: string }): Promise<void> {
  const scope = await requireUserScope();
  const parsed = z.object({ adviceId: z.string().min(1), idempotencyKey: z.string().uuid() }).safeParse(input);
  if (!parsed.success) throw new Error("INVALID_ADVICE_ACCEPTANCE");
  await createAcceptScheduleAdviceService(scope).acceptScheduleAdvice(parsed.data);
  revalidatePlan();
}

export async function dismissScheduleAdviceAction(formData: FormData): Promise<void> {
  const scope = await requireUserScope();
  const parsed = z.object({ adviceId: z.string().min(1) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("INVALID_ADVICE_DISMISSAL");
  const { createPrismaPlannerRepository } = await import("@/modules/planner/infrastructure/prisma-planner-repository");
  const { getPrismaClient } = await import("@/shared/db/prisma");
  await createPrismaPlannerRepository(getPrismaClient() as never, scope).dismissAdvice(parsed.data.adviceId);
  revalidatePlan();
}
