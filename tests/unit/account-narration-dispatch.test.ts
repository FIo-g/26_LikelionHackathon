import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NarrationRequest } from "@/modules/narration/application/generate-narration";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const mocks = vi.hoisted(() => ({
  recalculateAnalysis: vi.fn(),
}));

vi.mock("@/modules/analysis/application/recalculate-analysis", () => ({
  recalculateAnalysis: mocks.recalculateAnalysis,
}));

import { createPrismaAccountRepository } from "@/modules/account/infrastructure/prisma-account-repository";

const now = new Date("2026-08-20T03:00:00.000Z");
const facts: NarrationFacts = {
  target: { kind: "analysis", id: "analysis-current" },
  algorithmVersion: "provisional-v1",
  metrics: [{ id: "readiness", value: 72, band: "보통" }],
  dataBasis: {
    periodStart: "2026-08-06",
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

const request: NarrationRequest = { narrationId: "narration-current", facts };

const createNarrationRepository = (): NarrationRepository => ({
  createPending: vi.fn(async () => ({ narrationId: request.narrationId, created: true })),
  markReady: vi.fn(async () => undefined),
  markFallback: vi.fn(async () => undefined),
  recoverStalePending: vi.fn(async () => 0),
  retry: vi.fn(async () => null),
  findForAnalysisSnapshot: vi.fn(async () => null),
});

const createClient = (profileTimezone: string, events: string[]) => {
  let committed = false;
  const transaction = {
    narration: {},
    userProfile: {
      findUnique: vi.fn(async () => ({ timezone: profileTimezone })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    sleepGoal: { updateMany: vi.fn(async () => ({ count: 1 })) },
    sleepPlan: { updateMany: vi.fn(async () => ({ count: 0 })) },
    planDay: { updateMany: vi.fn(async () => ({ count: 0 })) },
    scheduleAdvice: { updateMany: vi.fn(async () => ({ count: 0 })) },
    analysisSnapshot: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  const client = {
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>): Promise<T> => {
      events.push("transaction:start");
      const result = await work(transaction);
      committed = true;
      events.push("transaction:commit");
      return result;
    },
  };

  return { client, transaction, isCommitted: () => committed };
};

describe("account analysis narration dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recalculateAnalysis.mockImplementation(async (_repository, _dates, _clock, narrationRepository) => {
      expect(narrationRepository).not.toBeNull();
      return [{ localDate: "2026-08-20", snapshotId: "analysis-current", pendingNarration: request }];
    });
  });

  it("queues narration in a timezone-change transaction and dispatches it only after commit", async () => {
    const events: string[] = [];
    const { client, isCommitted } = createClient("Asia/Seoul", events);
    const narrationRepository = createNarrationRepository();
    const provider = {
      generate: vi.fn(async () => {
        events.push(`provider:${isCommitted()}`);
        throw new Error("provider unavailable");
      }),
    };
    const narrationRepositoryFactory = vi.fn(() => narrationRepository);
    const repository = createPrismaAccountRepository(client as never, {
      now: () => now,
      narrationRepositoryFactory,
      narrationDependencies: { provider, repository: narrationRepository },
    });

    await repository.updateProfile(
      { userId: "account-user", timezone: "Asia/Seoul" },
      { nickname: "계정 사용자", timezone: "Europe/London" },
    );

    expect(narrationRepositoryFactory).toHaveBeenCalledWith(
      expect.anything(),
      { userId: "account-user", timezone: "Europe/London" },
    );
    expect(events).toEqual(["transaction:start", "transaction:commit", "provider:true"]);
    expect(narrationRepository.markFallback).toHaveBeenCalledWith(
      request.narrationId,
      expect.objectContaining({ schemaVersion: 1 }),
    );
  });

  it("uses the current user scope when a sleep-goal change refreshes analysis", async () => {
    const events: string[] = [];
    const { client, isCommitted } = createClient("Asia/Seoul", events);
    const narrationRepository = createNarrationRepository();
    const narrationRepositoryFactory = vi.fn(() => narrationRepository);
    const provider = {
      generate: vi.fn(async () => {
        events.push(`provider:${isCommitted()}`);
        throw new Error("provider unavailable");
      }),
    };
    const scope = { userId: "account-user", timezone: "Asia/Seoul" };
    const repository = createPrismaAccountRepository(client as never, {
      now: () => now,
      narrationRepositoryFactory,
      narrationDependencies: { provider, repository: narrationRepository },
    });

    await repository.updateSleepGoal(scope, {
      targetBedTime: "23:30",
      targetWakeTime: "07:00",
      targetDurationMinutes: 450,
    });

    expect(narrationRepositoryFactory).toHaveBeenCalledWith(expect.anything(), scope);
    expect(events).toEqual(["transaction:start", "transaction:commit", "provider:true"]);
    expect(narrationRepository.markFallback).toHaveBeenCalledOnce();
  });
});
