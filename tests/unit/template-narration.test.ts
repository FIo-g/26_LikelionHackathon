import { describe, expect, it } from "vitest";
import { buildTemplateNarration } from "@/modules/narration/domain/build-template-narration";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const facts: NarrationFacts = {
  target: { kind: "analysis", id: "snapshot-1" },
  algorithmVersion: "provisional-v1",
  metrics: [{ id: "readiness", value: 72, band: "보통" }],
  dataBasis: { periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 1, missingFields: [], sourceDistribution: { manual: 10 } },
  evidence: [],
  event: null,
  proposal: null,
  confidence: "medium",
};

describe("buildTemplateNarration", () => {
  it("creates the deterministic Korean analysis fallback", () => {
    expect(buildTemplateNarration(facts)).toMatchObject({
      headline: "현재 기록으로 본 수면 준비 상태",
      bullets: expect.any(Array),
    });
  });
});
