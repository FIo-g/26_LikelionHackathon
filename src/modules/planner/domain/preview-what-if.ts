import { Temporal } from "@js-temporal/polyfill";

import { calculateAnalysis as calculateProvisionalAnalysis } from "@/modules/analysis/domain/provisional-v1";
import type { AnalysisResult, NormalizedAnalysisInput } from "@/modules/analysis/domain/types";

export type WhatIfPreview = Readonly<{
  kind: "caffeine-added";
  before: AnalysisResult;
  after: AnalysisResult;
  delta: number | null;
  actualRecordHref: "/record/caffeine";
}>;

export type CaffeineWhatIfInput = Readonly<{
  input: NormalizedAnalysisInput;
  caffeine: Readonly<{ consumedAt: string; caffeineMg: number }>;
}>;

const localDateForInstant = (instant: string, timezone: string): string => (
  Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDate().toString()
);

export const previewWhatIf = (
  request: CaffeineWhatIfInput,
  dependencies: Readonly<{ calculateAnalysis?: (input: NormalizedAnalysisInput) => AnalysisResult }> = {},
): WhatIfPreview => {
  const calculateAnalysis = dependencies.calculateAnalysis ?? calculateProvisionalAnalysis;
  const caffeineLocalDate = localDateForInstant(request.caffeine.consumedAt, request.input.timezone);
  let caffeineAdded = false;
  const afterInput: NormalizedAnalysisInput = {
    ...request.input,
    days: request.input.days.map((day) => {
      if (day.localDate !== caffeineLocalDate) return { ...day, caffeine: [...day.caffeine] };
      caffeineAdded = true;
      return {
        ...day,
        caffeine: [...day.caffeine, { ...request.caffeine }],
      };
    }),
  };
  if (!caffeineAdded) throw new Error("WHAT_IF_DATE_OUT_OF_RANGE");

  const before = calculateAnalysis(request.input);
  const after = calculateAnalysis(afterInput);
  return {
    kind: "caffeine-added",
    before,
    after,
    delta: before.readiness === null || after.readiness === null ? null : after.readiness - before.readiness,
    actualRecordHref: "/record/caffeine",
  };
};
