type NarrationOutcome = "ready" | "template-fallback";

/** Emits only aggregate operational fields; never pass identifiers or user content. */
export const logNarrationOutcome = (
  outcome: NarrationOutcome,
  durationMs: number,
): void => {
  console.info({
    event: "narration_generation",
    outcome,
    durationMs: Math.max(0, Math.round(durationMs)),
  });
};
