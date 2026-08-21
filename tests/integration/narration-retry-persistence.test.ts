import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { retryNarration } from "@/modules/narration/application/generate-narration";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";
import type { NarrationFacts } from "@/modules/narration/domain/types";
import { createTestPrismaClient } from "../support/prisma-client";

const sqliteUrl = process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : null;
const describeSqlite = sqliteUrl ? describe : describe.skip;
const scope = { userId: "narration-retry-persistence-user", timezone: "Asia/Seoul" };
const snapshotIds = {
  ready: "narration-retry-ready-snapshot",
  fallback: "narration-retry-fallback-snapshot",
} as const;

const factsFor = (snapshotId: string): NarrationFacts => ({
  target: { kind: "analysis", id: snapshotId },
  algorithmVersion: "provisional-v1",
  metrics: [],
  dataBasis: {
    periodStart: "",
    periodEnd: "",
    sampleCount: 0,
    excludedCount: 0,
    missingFields: [],
    sourceDistribution: { manual: 0 },
  },
  evidence: [],
  event: null,
  proposal: null,
  confidence: "low",
});

const fallbackOutput = {
  schemaVersion: 1 as const,
  headline: "초기 리포트",
  body: "저장된 패턴을 바탕으로 정리했어요.",
  bullets: ["다음 기록을 이어가 보세요."],
};

const prisma = createTestPrismaClient(sqliteUrl ?? "file:./prisma/unused-narration-retry.sqlite") as PrismaClient;

describeSqlite("Narration retry persistence", () => {
  beforeAll(async () => {
    await prisma.user.upsert({ where: { id: scope.userId }, update: {}, create: { id: scope.userId } });
    await Promise.all(Object.entries(snapshotIds).map(async ([key, id]) => {
      await prisma.analysisSnapshot.upsert({
        where: { currentKey: `narration-retry-${key}-current` },
        update: {},
        create: {
          id,
          userId: scope.userId,
          localDate: key === "ready" ? "2026-08-20" : "2026-08-21",
          timezone: scope.timezone,
          status: "current",
          result: {},
          currentKey: `narration-retry-${key}-current`,
        },
      });
    }));
  });

  beforeEach(async () => {
    await prisma.narration.deleteMany({ where: { userId: scope.userId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists a validated provider result as ready after a retry", async () => {
    const repository = createPrismaNarrationRepository(prisma as never, scope);
    const created = await repository.createPending(
      { analysisSnapshotId: snapshotIds.ready, scheduleAdviceId: null },
      "retry-ready-hash",
      factsFor(snapshotIds.ready),
    );
    await repository.markFallback(created.narrationId, fallbackOutput);

    await expect(retryNarration(created.narrationId, {
      repository,
      provider: {
        generate: async () => ({
          headline: "AI 수면 리포트",
          body: "저장된 기록의 패턴을 바탕으로 정리했어요.",
          bullets: ["다음 기록을 이어가 보세요."],
        }),
      },
    })).resolves.toBe("ready");

    await expect(prisma.narration.findFirst({ where: { id: created.narrationId, userId: scope.userId } })).resolves.toMatchObject({
      status: "ready",
      retryCount: 1,
      output: {
        schemaVersion: 1,
        headline: "AI 수면 리포트",
      },
    });
  });

  it("persists a template fallback, rather than falsely ready output, when a retried model fails", async () => {
    const repository = createPrismaNarrationRepository(prisma as never, scope);
    const created = await repository.createPending(
      { analysisSnapshotId: snapshotIds.fallback, scheduleAdviceId: null },
      "retry-fallback-hash",
      factsFor(snapshotIds.fallback),
    );
    await repository.markFallback(created.narrationId, fallbackOutput);

    await expect(retryNarration(created.narrationId, {
      repository,
      provider: {
        generate: async () => {
          throw new Error("provider unavailable");
        },
      },
    })).resolves.toBe("template-fallback");

    await expect(prisma.narration.findFirst({ where: { id: created.narrationId, userId: scope.userId } })).resolves.toMatchObject({
      status: "template-fallback",
      retryCount: 1,
      output: {
        schemaVersion: 1,
        headline: "현재 기록으로 본 수면 준비 상태",
      },
    });
  });
});
