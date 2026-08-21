import { withTimeout } from "@/shared/time/with-timeout";
import { ZodError } from "zod";
import { logNarrationOutcome, type NarrationFallbackReason } from "@/shared/observability/operational-log";
import { buildTemplateNarration } from "../domain/build-template-narration";
import { narrationOutputSchema } from "../domain/narration-schema";
import { NarrationProviderError, type NarrationFacts } from "../domain/types";
import { validateNarrationAgainstFacts } from "../domain/validate-narration";
import type { NarrationProvider, NarrationRepository } from "./ports";

export type NarrationRequest = Readonly<{ narrationId: string; facts: NarrationFacts }>;

export type NarrationDependencies = Readonly<{
  provider: NarrationProvider | null;
  repository: NarrationRepository;
}>;

export type NarrationGenerationOutcome = "ready" | "template-fallback";

export type NarrationRetryOutcome = NarrationGenerationOutcome | "unavailable" | "not-retryable";

const fallbackReasonFor = (
  error: unknown,
  provider: NarrationProvider | null,
): NarrationFallbackReason => {
  if (!provider) return "provider-unavailable";
  if (error instanceof ZodError) return "invalid-output";
  if (!(error instanceof NarrationProviderError)) return "provider-error";

  switch (error.code) {
    case "TIMEOUT":
      return "timeout";
    case "UNPARSED_RESPONSE":
      return "invalid-output";
    case "UNSUPPORTED_CLAIM":
      return "unsupported-claim";
    case "REFUSAL":
      return "provider-refusal";
  }
};

export async function generateNarration(
  request: NarrationRequest,
  deps: NarrationDependencies,
): Promise<NarrationGenerationOutcome> {
  const startedAt = Date.now();
  try {
    if (!deps.provider) throw new NarrationProviderError("UNPARSED_RESPONSE");
    const output = narrationOutputSchema.parse(
      await withTimeout((signal) => deps.provider!.generate(request.facts, signal), 8_000),
    );
    const validation = validateNarrationAgainstFacts(output, request.facts);
    if (!validation.valid) throw new NarrationProviderError("UNSUPPORTED_CLAIM");
    await deps.repository.markReady(request.narrationId, { schemaVersion: 1, ...output });
    logNarrationOutcome("ready", Date.now() - startedAt);
    return "ready";
  } catch (error) {
    const output = buildTemplateNarration(request.facts);
    await deps.repository.markFallback(request.narrationId, { schemaVersion: 1, ...output });
    logNarrationOutcome("template-fallback", Date.now() - startedAt, fallbackReasonFor(error, deps.provider));
    return "template-fallback";
  }
}

export const settleNarrationRequests = async (
  requests: readonly NarrationRequest[],
  dependencies: NarrationDependencies | null,
): Promise<void> => {
  if (!dependencies) return;
  await Promise.allSettled(requests.map((request) => generateNarration(request, dependencies)));
};

export const recoverStaleNarrations = async (now: Date, repository: NarrationRepository): Promise<number> => (
  repository.recoverStalePending(now)
);

export const retryNarration = async (
  narrationId: string,
  dependencies: NarrationDependencies,
): Promise<NarrationRetryOutcome> => {
  // Do not consume a user's finite retry count when the server cannot call a provider at all.
  if (!dependencies.provider) return "unavailable";

  const request = await dependencies.repository.retry(narrationId);
  if (!request) return "not-retryable";
  return generateNarration(request, dependencies);
};
