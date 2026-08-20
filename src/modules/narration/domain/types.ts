import type { AnalysisResult } from "@/modules/analysis/domain/types";
import type { ScheduleProposal } from "@/modules/planner/domain/types";
import type { ConfidenceLevel } from "@/shared/domain/contracts";

export const NARRATION_METRIC_LABELS: Readonly<Record<string, readonly string[]>> = {
  readiness: ["수면 준비 상태", "수면 준비", "준비도", "readiness"],
  "sleep-rhythm": ["수면 리듬", "sleep rhythm"],
  "phone-wind-down": ["폰 정리", "휴대폰", "phone wind-down"],
  "caffeine-signal": ["카페인 점수", "카페인", "caffeine"],
  "sleep-goal": ["수면 목표", "sleep goal"],
};

export type NarrationTarget =
  | Readonly<{ analysisSnapshotId: string; scheduleAdviceId: null }>
  | Readonly<{ analysisSnapshotId: null; scheduleAdviceId: string }>;

export type NarrationFacts = Readonly<{
  target: { kind: "analysis"; id: string } | { kind: "advice"; id: string };
  algorithmVersion: "provisional-v1";
  metrics: readonly Readonly<{ id: string; value: number | null; band: string }>[];
  dataBasis: Readonly<{
    periodStart: string;
    periodEnd: string;
    sampleCount: number;
    excludedCount: number;
    missingFields: readonly string[];
    sourceDistribution: Readonly<Record<"manual", number>>;
  }>;
  evidence: readonly Readonly<{ code: string; direction: "positive" | "negative" | "neutral"; count: number | null }>[];
  event: Readonly<{ type: string; startsAt: string }> | null;
  proposal: ScheduleProposal | null;
  confidence: ConfidenceLevel;
}>;

export type NarrationOutput = Readonly<{
  headline: string;
  body: string;
  bullets: readonly string[];
}>;

export class NarrationProviderError extends Error {
  constructor(readonly code: "UNPARSED_RESPONSE" | "REFUSAL" | "TIMEOUT" | "UNSUPPORTED_CLAIM") {
    super(code);
  }
}

const metricBand = (value: number | null): string => {
  if (value === null) return "기록 필요";
  if (value >= 75) return "높음";
  if (value >= 50) return "보통";
  return "낮음";
};

const emptyDataBasis = {
  periodStart: "",
  periodEnd: "",
  sampleCount: 0,
  excludedCount: 0,
  missingFields: [],
  sourceDistribution: { manual: 0 },
} as const;

export const buildNarrationInput = (facts: NarrationFacts): NarrationFacts => ({
  target: facts.target.kind === "analysis"
    ? { kind: "analysis", id: facts.target.id }
    : { kind: "advice", id: facts.target.id },
  algorithmVersion: facts.algorithmVersion,
  metrics: facts.metrics.map((metric) => ({ id: metric.id, value: metric.value, band: metric.band })),
  dataBasis: {
    periodStart: facts.dataBasis.periodStart,
    periodEnd: facts.dataBasis.periodEnd,
    sampleCount: facts.dataBasis.sampleCount,
    excludedCount: facts.dataBasis.excludedCount,
    missingFields: [...facts.dataBasis.missingFields],
    sourceDistribution: { manual: facts.dataBasis.sourceDistribution.manual },
  },
  evidence: facts.evidence.map((evidence) => ({ code: evidence.code, direction: evidence.direction, count: evidence.count })),
  event: facts.event ? { type: facts.event.type, startsAt: facts.event.startsAt } : null,
  proposal: facts.proposal,
  confidence: facts.confidence,
});

export const buildAnalysisNarrationFacts = (snapshotId: string, result: AnalysisResult): NarrationFacts => buildNarrationInput({
  target: { kind: "analysis", id: snapshotId },
  algorithmVersion: "provisional-v1",
  metrics: [
    { id: "readiness", value: result.readiness, band: metricBand(result.readiness) },
    { id: "sleep-rhythm", value: result.metrics.sleepRhythmStability, band: metricBand(result.metrics.sleepRhythmStability) },
    { id: "phone-wind-down", value: result.metrics.phoneWindDown, band: metricBand(result.metrics.phoneWindDown) },
    { id: "caffeine-signal", value: result.metrics.caffeineSignal, band: metricBand(result.metrics.caffeineSignal) },
    { id: "sleep-goal", value: result.metrics.sleepGoalAttainment, band: metricBand(result.metrics.sleepGoalAttainment) },
  ],
  dataBasis: {
    periodStart: result.dataBasis.periodStart,
    periodEnd: result.dataBasis.periodEnd,
    sampleCount: result.dataBasis.sampleCount,
    excludedCount: result.dataBasis.excludedCount,
    missingFields: result.dataBasis.missingFields,
    sourceDistribution: result.dataBasis.sourceDistribution,
  },
  evidence: result.evidence.map((evidence) => ({ code: evidence.code, direction: evidence.direction, count: evidence.count })),
  event: null,
  proposal: null,
  confidence: result.confidence,
});

export const buildAdviceNarrationFacts = (
  adviceId: string,
  proposal: ScheduleProposal,
  event: Readonly<{ type: string; startsAt: string }> | null,
): NarrationFacts => buildNarrationInput({
  target: { kind: "advice", id: adviceId },
  algorithmVersion: "provisional-v1",
  metrics: [],
  dataBasis: emptyDataBasis,
  evidence: proposal.evidence.map((evidence) => ({ code: evidence.code, direction: evidence.direction, count: evidence.count })),
  event,
  proposal,
  confidence: proposal.confidence,
});
