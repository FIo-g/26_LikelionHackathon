import { describe, expect, it } from "vitest";
import { validateNarrationAgainstFacts } from "@/modules/narration/domain/validate-narration";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const facts: NarrationFacts = {
  target: { kind: "analysis", id: "snapshot-1" }, algorithmVersion: "provisional-v1",
  metrics: [{ id: "readiness", value: 72, band: "보통" }],
  dataBasis: { periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 1, missingFields: [], sourceDistribution: { manual: 10 } },
  evidence: [{ code: "sleep", direction: "positive", count: 2 }], event: null, proposal: null, confidence: "medium",
};

describe("validateNarrationAgainstFacts", () => {
  it("rejects unsupported numbers and medical or causal claims", () => {
    expect(validateNarrationAgainstFacts(
      { headline: "점수 97점", body: "카페인이 원인입니다.", bullets: [] },
      facts,
    )).toEqual({ valid: false, code: "UNSUPPORTED_CLAIM" });
  });

  it("accepts output that only repeats immutable fact numbers", () => {
    expect(validateNarrationAgainstFacts(
      { headline: "현재 72점", body: "10일 기록을 살펴봤어요.", bullets: ["수면 패턴을 관찰해 보세요."] },
      facts,
    )).toEqual({ valid: true });
  });

  it("rejects a metric label paired with another metric's value", () => {
    const multipleMetrics: NarrationFacts = {
      ...facts,
      metrics: [
        { id: "readiness", value: 72, band: "보통" },
        { id: "caffeine-signal", value: 55, band: "보통" },
      ],
    };

    expect(validateNarrationAgainstFacts(
      { headline: "카페인 점수는 72점입니다.", body: "", bullets: [] },
      multipleMetrics,
    )).toEqual({ valid: false, code: "UNSUPPORTED_CLAIM" });
  });

  it("rejects another metric's value when it appears before the metric label", () => {
    const multipleMetrics: NarrationFacts = {
      ...facts,
      metrics: [
        { id: "readiness", value: 72, band: "보통" },
        { id: "caffeine-signal", value: 55, band: "보통" },
      ],
    };

    expect(validateNarrationAgainstFacts(
      { headline: "72점인 카페인 점수", body: "", bullets: [] },
      multipleMetrics,
    )).toEqual({ valid: false, code: "UNSUPPORTED_CLAIM" });
  });

  it("accepts a metric's own value before its label", () => {
    const multipleMetrics: NarrationFacts = {
      ...facts,
      metrics: [
        { id: "readiness", value: 72, band: "보통" },
        { id: "caffeine-signal", value: 55, band: "보통" },
      ],
    };

    expect(validateNarrationAgainstFacts(
      { headline: "55점인 카페인 점수", body: "", bullets: [] },
      multipleMetrics,
    )).toEqual({ valid: true });
  });
});
