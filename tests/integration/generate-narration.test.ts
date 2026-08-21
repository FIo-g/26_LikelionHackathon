import { describe, expect, it, vi } from "vitest";
import { generateNarration, retryNarration } from "@/modules/narration/application/generate-narration";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const facts: NarrationFacts = {
  target: { kind: "analysis", id: "snapshot-1" }, algorithmVersion: "provisional-v1",
  metrics: [{ id: "readiness", value: 72, band: "보통" }],
  dataBasis: { periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 1, missingFields: [], sourceDistribution: { manual: 10 } },
  evidence: [], event: null, proposal: null, confidence: "medium",
};

describe("generateNarration", () => {
  it("uses a deterministic Korean fallback after provider failure", async () => {
    const provider = { generate: vi.fn().mockRejectedValue(new Error("timeout")) };
    const repository = { createPending: vi.fn(), markReady: vi.fn(), markFallback: vi.fn(), recoverStalePending: vi.fn(), retry: vi.fn(), findForAnalysisSnapshot: vi.fn() };

    await generateNarration({ narrationId: "narration-1", facts }, { provider, repository });

    expect(repository.markFallback).toHaveBeenCalledWith("narration-1", expect.objectContaining({
      schemaVersion: 1,
      headline: "현재 기록으로 본 수면 준비 상태",
    }));
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it("stores ready output only after schema and immutable-fact validation", async () => {
    const provider = { generate: vi.fn().mockResolvedValue({ headline: "현재 72점", body: "10일 기록을 살펴봤어요.", bullets: [] }) };
    const repository = { createPending: vi.fn(), markReady: vi.fn(), markFallback: vi.fn(), recoverStalePending: vi.fn(), retry: vi.fn(), findForAnalysisSnapshot: vi.fn() };

    await generateNarration({ narrationId: "narration-1", facts }, { provider, repository });

    expect(repository.markReady).toHaveBeenCalledWith("narration-1", expect.objectContaining({ schemaVersion: 1 }));
    expect(repository.markFallback).not.toHaveBeenCalled();
  });

  it("falls back when a non-OpenAI provider returns malformed output", async () => {
    const provider = { generate: vi.fn().mockResolvedValue({ headline: "ok", body: "ok", bullets: [], extra: "not allowed" }) };
    const repository = { createPending: vi.fn(), markReady: vi.fn(), markFallback: vi.fn(), recoverStalePending: vi.fn(), retry: vi.fn(), findForAnalysisSnapshot: vi.fn() };

    await generateNarration({ narrationId: "narration-1", facts }, { provider, repository });

    expect(repository.markFallback).toHaveBeenCalledOnce();
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it("does not consume a retry when no model provider is configured", async () => {
    const repository = { createPending: vi.fn(), markReady: vi.fn(), markFallback: vi.fn(), recoverStalePending: vi.fn(), retry: vi.fn(), findForAnalysisSnapshot: vi.fn() };

    await expect(retryNarration("narration-1", { provider: null, repository })).resolves.toBe("unavailable");

    expect(repository.retry).not.toHaveBeenCalled();
    expect(repository.markReady).not.toHaveBeenCalled();
    expect(repository.markFallback).not.toHaveBeenCalled();
  });
});
