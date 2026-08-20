"use server";

import { previewCaffeineWhatIf } from "@/modules/planner/application/preview-what-if";
import { parseUnambiguousLocalEventTime } from "@/modules/planner/application/parse-local-event-time";
import { createAnalysisRepository } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import { getPrismaClient } from "@/shared/db/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { retryNarration } from "@/modules/narration/application/generate-narration";
import { createOpenAiNarrationProvider } from "@/modules/narration/infrastructure/openai-narration-provider";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";
import type { TransactionClient } from "@/shared/db/transaction";

export type CaffeineWhatIfActionState =
  | Readonly<{ status: "idle" }>
  | Readonly<{
      status: "success";
      beforeReadiness: number | null;
      afterReadiness: number | null;
      delta: number | null;
      actualRecordHref: string;
    }>
  | Readonly<{ status: "error"; message: string }>;

export type NarrationRetryActionState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "success"; message: string }>
  | Readonly<{ status: "error"; message: string }>;

export const previewCaffeineWhatIfAction = async (
  _previousState: CaffeineWhatIfActionState,
  formData: FormData,
): Promise<CaffeineWhatIfActionState> => {
  const caffeineMg = Number(formData.get("caffeineMg"));
  const consumedAt = formData.get("consumedAt");

  if (!Number.isFinite(caffeineMg) || caffeineMg < 0 || caffeineMg > 1_000) {
    return { status: "error", message: "카페인 양을 0에서 1000mg 사이로 입력해 주세요." };
  }

  if (typeof consumedAt !== "string" || consumedAt.length === 0) {
    return { status: "error", message: "섭취 시간을 확인해 주세요." };
  }

  const scope = await requireUserScope();
  let preview;
  try {
    preview = await previewCaffeineWhatIf(
      scope,
      createAnalysisRepository(getPrismaClient(), scope),
      {
        caffeineMg,
        consumedAt: parseUnambiguousLocalEventTime(consumedAt, scope.timezone),
      },
    );
  } catch {
    return { status: "error", message: "미리보기를 준비하지 못했어요. 시간을 바꾸어 다시 시도해 주세요." };
  }
  return {
    status: "success",
    beforeReadiness: preview.before.readiness,
    afterReadiness: preview.after.readiness,
    delta: preview.delta,
    actualRecordHref: "/record/caffeine",
  };
};

export const retryNarrationAction = async (
  _previousState: NarrationRetryActionState,
  formData: FormData,
): Promise<NarrationRetryActionState> => {
  const parsed = z.object({ narrationId: z.string().min(1) }).safeParse({ narrationId: formData.get("narrationId") });
  if (!parsed.success) return { status: "error", message: "다시 시도할 리포트를 확인할 수 없어요." };

  try {
    const scope = await requireUserScope();
    const repository = createPrismaNarrationRepository(getPrismaClient() as TransactionClient, scope);
    const retried = await retryNarration(parsed.data.narrationId, {
      provider: createOpenAiNarrationProvider(),
      repository,
    });
    if (!retried) return { status: "error", message: "이 리포트는 더 이상 다시 시도할 수 없어요." };
    revalidatePath("/analyze");
    return { status: "success", message: "리포트를 다시 준비했어요." };
  } catch {
    return { status: "error", message: "리포트를 다시 준비하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
};
