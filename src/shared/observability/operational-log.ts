type NarrationOutcome = "ready" | "template-fallback";

export type NarrationFallbackReason =
  | "provider-unavailable"
  | "timeout"
  | "invalid-output"
  | "unsupported-claim"
  | "provider-refusal"
  | "provider-error";

/** Emits only aggregate operational fields; never pass identifiers or user content. */
export const logNarrationOutcome = (
  outcome: NarrationOutcome,
  durationMs: number,
  reason?: NarrationFallbackReason,
): void => {
  console.info({
    event: "narration_generation",
    outcome,
    durationMs: Math.max(0, Math.round(durationMs)),
    ...(outcome === "template-fallback" && reason ? { reason } : {}),
  });
};
