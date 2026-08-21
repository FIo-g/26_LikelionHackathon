import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNarration } from "@/modules/narration/application/generate-narration";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const facts: NarrationFacts = {
  target: { kind: "analysis", id: "private-analysis-snapshot-123" },
  algorithmVersion: "provisional-v1",
  metrics: [{ id: "readiness", value: 72, band: "보통" }],
  dataBasis: {
    periodStart: "2026-08-07",
    periodEnd: "2026-08-20",
    sampleCount: 14,
    excludedCount: 0,
    missingFields: [],
    sourceDistribution: { manual: 14 },
  },
  evidence: [],
  event: null,
  proposal: null,
  confidence: "medium",
};

const repository = () => ({
  createPending: vi.fn(),
  markReady: vi.fn(),
  markFallback: vi.fn().mockResolvedValue(undefined),
  recoverStalePending: vi.fn(),
  retry: vi.fn(),
  findForAnalysisSnapshot: vi.fn(),
}) as unknown as NarrationRepository;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("narration fallback operational logging", () => {
  it("logs a provider-unavailable fallback with only allowlisted aggregate fields", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(generateNarration(
      { narrationId: "private-narration-123", facts },
      { provider: null, repository: repository() },
    )).resolves.toBe("template-fallback");

    const [payload] = info.mock.calls[0] ?? [];
    expect(payload).toMatchObject({
      event: "narration_generation",
      outcome: "template-fallback",
      reason: "provider-unavailable",
    });
    expect(Object.keys(payload as object).sort()).toEqual(["durationMs", "event", "outcome", "reason"]);
    expect(JSON.stringify(payload)).not.toContain("private-narration-123");
    expect(JSON.stringify(payload)).not.toContain("private-analysis-snapshot-123");
  });

  it("logs an unsupported-claim fallback without emitting narration facts or identifiers", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const provider = {
      generate: vi.fn().mockResolvedValue({
        headline: "수면 준비 상태 999",
        body: "기록을 정리했어요.",
        bullets: [],
      }),
    };

    await expect(generateNarration(
      { narrationId: "private-narration-456", facts },
      { provider, repository: repository() },
    )).resolves.toBe("template-fallback");

    const [payload] = info.mock.calls[0] ?? [];
    expect(payload).toMatchObject({
      event: "narration_generation",
      outcome: "template-fallback",
      reason: "unsupported-claim",
    });
    expect(Object.keys(payload as object).sort()).toEqual(["durationMs", "event", "outcome", "reason"]);
    expect(JSON.stringify(payload)).not.toContain("private-narration-456");
    expect(JSON.stringify(payload)).not.toContain("private-analysis-snapshot-123");
  });
});
