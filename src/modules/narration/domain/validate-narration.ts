import { NARRATION_METRIC_LABELS, type NarrationFacts, type NarrationOutput } from "./types";

const DENIED_CLAIMS = /원인이다|원인입니다|치료|진단|처방|약물/;
const numericToken = /\d+(?:\.\d+)?/g;

const normalizeNumericToken = (value: string): string => String(Number(value));
const numericTokens = (value: unknown): Set<string> => new Set(
  (JSON.stringify(value).match(numericToken) ?? []).map(normalizeNumericToken),
);
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasMetricMismatch = (text: string, facts: NarrationFacts): boolean => facts.metrics.some((metric) => {
  const expected = metric.value === null ? null : normalizeNumericToken(String(metric.value));
  const labels = NARRATION_METRIC_LABELS[metric.id] ?? [metric.id];
  return labels.some((label) => {
    const pairedValue = new RegExp(`${escapeRegExp(label)}[^\\d.!?\\n]{0,24}(\\d+(?:\\.\\d+)?)`, "gi");
    return [...text.matchAll(pairedValue)].some((match) => (
      expected === null || normalizeNumericToken(match[1]) !== expected
    ));
  });
});

export const validateNarrationAgainstFacts = (
  output: NarrationOutput,
  facts: NarrationFacts,
): { valid: true } | { valid: false; code: "UNSUPPORTED_CLAIM" } => {
  const text = [output.headline, output.body, ...output.bullets].join(" ");
  if (DENIED_CLAIMS.test(text)) return { valid: false, code: "UNSUPPORTED_CLAIM" };
  if (hasMetricMismatch(text, facts)) return { valid: false, code: "UNSUPPORTED_CLAIM" };

  const allowed = numericTokens(facts);
  for (const token of text.match(numericToken) ?? []) {
    if (!allowed.has(normalizeNumericToken(token))) return { valid: false, code: "UNSUPPORTED_CLAIM" };
  }

  return { valid: true };
};
