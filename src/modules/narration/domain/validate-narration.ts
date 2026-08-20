import type { NarrationFacts, NarrationOutput } from "./types";

const DENIED_CLAIMS = /원인이다|원인입니다|치료|진단|처방|약물/;
const numericToken = /\d+(?:\.\d+)?/g;

const numericTokens = (value: unknown): Set<string> => new Set(JSON.stringify(value).match(numericToken) ?? []);

export const validateNarrationAgainstFacts = (
  output: NarrationOutput,
  facts: NarrationFacts,
): { valid: true } | { valid: false; code: "UNSUPPORTED_CLAIM" } => {
  const text = [output.headline, output.body, ...output.bullets].join(" ");
  if (DENIED_CLAIMS.test(text)) return { valid: false, code: "UNSUPPORTED_CLAIM" };

  const allowed = numericTokens(facts);
  for (const token of text.match(numericToken) ?? []) {
    if (!allowed.has(token)) return { valid: false, code: "UNSUPPORTED_CLAIM" };
  }

  return { valid: true };
};
