import { describe, expect, it, vi } from "vitest";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };
const facts: NarrationFacts = {
  target: { kind: "analysis", id: "snapshot-1" }, algorithmVersion: "provisional-v1", metrics: [],
  dataBasis: { periodStart: "", periodEnd: "", sampleCount: 0, excludedCount: 0, missingFields: [], sourceDistribution: { manual: 0 } },
  evidence: [], event: null, proposal: null, confidence: "low",
};

describe("PrismaNarrationRepository", () => {
  it("uses ownership-scoped updateMany for ready and fallback status writes", async () => {
    const narration = { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const repository = createPrismaNarrationRepository({ narration } as never, scope);

    await repository.markReady("narration-1", { schemaVersion: 1, headline: "제목", body: "본문", bullets: [] });
    await repository.markFallback("narration-1", { schemaVersion: 1, headline: "제목", body: "본문", bullets: [] });

    expect(narration.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "narration-1", userId: "user-1", status: "pending" }) }));
  });

  it("enforces exactly one narration target before persistence", async () => {
    const narration = { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() };
    const repository = createPrismaNarrationRepository({ narration } as never, scope);

    await expect(repository.createPending({ analysisSnapshotId: null, scheduleAdviceId: null } as never, "hash", facts)).rejects.toThrow("INVALID_NARRATION_TARGET");
  });

  it("atomically stores fallback for stale pending work and limits retries to two", async () => {
    const narration = {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ id: "narration-1", facts }]),
      findFirst: vi.fn().mockResolvedValue({ id: "narration-1", facts, retryCount: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const repository = createPrismaNarrationRepository({ narration } as never, scope);

    expect(await repository.recoverStalePending(new Date("2026-08-20T00:00:30.000Z"))).toBe(1);
    expect(await repository.retry("narration-1")).toMatchObject({ narrationId: "narration-1", facts });
    narration.findFirst.mockResolvedValueOnce({ id: "narration-1", facts, retryCount: 2 });
    expect(await repository.retry("narration-1")).toBeNull();
  });

  it("rejects corrupt persisted facts and output instead of exposing them as domain values", async () => {
    const narration = {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn()
        .mockResolvedValueOnce({ id: "narration-1", facts: { algorithmVersion: "tampered" }, retryCount: 0 })
        .mockResolvedValueOnce({ id: "narration-1", facts, retryCount: 0, status: "ready", output: { schemaVersion: 1, headline: "" } }),
      updateMany: vi.fn(),
    };
    const repository = createPrismaNarrationRepository(
      { narration } as unknown as Parameters<typeof createPrismaNarrationRepository>[0],
      scope,
    );

    await expect(repository.retry("narration-1")).rejects.toMatchObject({ code: "INVALID_JSON_VALUE" });
    await expect(repository.findForAnalysisSnapshot("snapshot-1")).rejects.toMatchObject({ code: "INVALID_JSON_VALUE" });
  });
});
