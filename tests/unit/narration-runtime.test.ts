import { describe, expect, it, vi } from "vitest";
import { generateNarration, settleNarrationRequests } from "@/modules/narration/application/generate-narration";
import { readNarrationEnvironment } from "@/modules/narration/infrastructure/openai-narration-provider";
import { withTimeout } from "@/shared/time/with-timeout";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const facts: NarrationFacts = {
  target: { kind: "analysis", id: "snapshot-1" }, algorithmVersion: "provisional-v1", metrics: [],
  dataBasis: { periodStart: "", periodEnd: "", sampleCount: 0, excludedCount: 0, missingFields: [], sourceDistribution: { manual: 0 } },
  evidence: [], event: null, proposal: null, confidence: "low",
};

describe("narration runtime safety", () => {
  it("treats missing or invalid model configuration as unavailable", async () => {
    expect(readNarrationEnvironment({ OPENAI_API_KEY: "key" })).toBeNull();
    expect(readNarrationEnvironment({ OPENAI_API_KEY: "key", OPENAI_MODEL: "gpt-5.3-codex-spark" })).toBeNull();
    expect(readNarrationEnvironment({ OPENAI_API_KEY: "key", OPENAI_MODEL: "gpt-5.6-terra" })).toMatchObject({ model: "gpt-5.6-terra" });

    const repository = { createPending: vi.fn(), markReady: vi.fn(), markFallback: vi.fn(), recoverStalePending: vi.fn(), retry: vi.fn(), findForAnalysisSnapshot: vi.fn() };
    await generateNarration({ narrationId: "narration-1", facts }, { provider: null, repository });
    expect(repository.markFallback).toHaveBeenCalledOnce();
  });

  it("aborts timed-out provider work and isolates post-commit dispatch failures", async () => {
    await expect(withTimeout((signal) => new Promise<void>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }), 1)).rejects.toMatchObject({ code: "TIMEOUT" });

    const repository = { createPending: vi.fn(), markReady: vi.fn(), markFallback: vi.fn().mockRejectedValue(new Error("write failed")), recoverStalePending: vi.fn(), retry: vi.fn(), findForAnalysisSnapshot: vi.fn() };
    await expect(settleNarrationRequests([{ narrationId: "narration-1", facts }], { provider: null, repository })).resolves.toBeUndefined();
  });
});
