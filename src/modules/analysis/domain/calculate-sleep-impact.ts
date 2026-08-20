import type { Evidence } from "@/shared/domain/contracts";
import { clampToRange, estimateConfidenceLevelFromScore } from "./calculate-confidence";
import type { SleepImpactInput, SleepImpactResult } from "./types";

const mean = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const evidenceDirection = (deltaMinutes: number): Evidence["direction"] => {
  if (deltaMinutes > 0) {
    return "positive";
  }

  if (deltaMinutes < 0) {
    return "negative";
  }

  return "neutral";
};

export const calculateSleepImpact = (input: SleepImpactInput): SleepImpactResult => {
  if (input.exposed.length < 3 || input.unexposed.length < 3) {
    return {
      factor: input.factor,
      exposedCount: input.exposed.length,
      unexposedCount: input.unexposed.length,
      deltaMinutes: null,
      confidence: "insufficient",
      evidence: [
        {
          code: "sleep-impact-insufficient-data",
          label: "노출군과 비노출군 데이터가 각각 최소 3개 이상 필요합니다.",
          direction: "neutral",
          value: null,
          count: null,
        },
      ],
    };
  }

  const exposedMean = mean(input.exposed);
  const unexposedMean = mean(input.unexposed);
  const deltaMinutes = exposedMean - unexposedMean;
  const sampleScore = clampToRange((input.exposed.length + input.unexposed.length) / 14, 0, 1);
  const confidence = estimateConfidenceLevelFromScore(sampleScore, false);

  return {
    factor: input.factor,
    exposedCount: input.exposed.length,
    unexposedCount: input.unexposed.length,
    deltaMinutes,
    confidence,
    evidence: [
      {
        code: deltaMinutes > 0
          ? "sleep-impact-positive-association"
          : deltaMinutes < 0
            ? "sleep-impact-negative-association"
            : "sleep-impact-neutral-association",
        label: `${input.factor} 노출군과 비노출군의 수면 시간 차이를 요약합니다.`,
        direction: evidenceDirection(deltaMinutes),
        value: Math.round(deltaMinutes * 100) / 100,
        count: input.exposed.length + input.unexposed.length,
      },
    ],
  };
};
