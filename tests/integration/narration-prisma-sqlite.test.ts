import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";
import type { NarrationFacts } from "@/modules/narration/domain/types";

const sqliteUrl = process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : null;
const describeSqlite = sqliteUrl ? describe : describe.skip;
const scope = { userId: "narration-sqlite-user", timezone: "Asia/Seoul" };
const facts: NarrationFacts = {
  target: { kind: "analysis", id: "snapshot-1" }, algorithmVersion: "provisional-v1", metrics: [],
  dataBasis: { periodStart: "", periodEnd: "", sampleCount: 0, excludedCount: 0, missingFields: [], sourceDistribution: { manual: 0 } },
  evidence: [], event: null, proposal: null, confidence: "low",
};

type NarrationPrisma = PrismaClient & { narration: {
  deleteMany: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<{ status: string; retryCount: number } | null>;
} };
const prisma = new PrismaClient() as NarrationPrisma;

describeSqlite("Narration SQLite contract", () => {
  beforeAll(async () => {
    await prisma.user.upsert({ where: { id: scope.userId }, update: {}, create: { id: scope.userId } });
    await prisma.analysisSnapshot.upsert({
      where: { currentKey: "narration-sqlite-current" },
      update: {},
      create: { id: "snapshot-1", userId: scope.userId, localDate: "2026-08-20", timezone: scope.timezone, status: "current", result: {}, currentKey: "narration-sqlite-current" },
    });
    await prisma.narration.deleteMany({ where: { userId: scope.userId } });
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it("enforces target uniqueness/XOR, ownership transitions, stale recovery, retry limits, and duplicate create recovery", async () => {
    const repository = createPrismaNarrationRepository(prisma as never, scope);
    const created = await repository.createPending({ analysisSnapshotId: "snapshot-1", scheduleAdviceId: null }, "hash", facts);
    const duplicate = await repository.createPending({ analysisSnapshotId: "snapshot-1", scheduleAdviceId: null }, "hash", facts);
    expect(created.created).toBe(true);
    expect(duplicate).toEqual({ narrationId: created.narrationId, created: false });
    await expect(repository.createPending({ analysisSnapshotId: null, scheduleAdviceId: null } as never, "hash", facts)).rejects.toThrow("INVALID_NARRATION_TARGET");
    await expect(repository.createPending({ analysisSnapshotId: "snapshot-1", scheduleAdviceId: "advice-1" } as never, "hash", facts)).rejects.toThrow("INVALID_NARRATION_TARGET");
    await prisma.narration.updateMany({ where: { id: created.narrationId }, data: { generatedAt: new Date("2026-08-20T00:00:00.000Z") } });
    expect(await repository.recoverStalePending(new Date("2026-08-20T00:00:31.000Z"))).toBe(1);
    expect((await prisma.narration.findFirst({ where: { id: created.narrationId } }))?.status).toBe("template-fallback");
    expect(await repository.retry(created.narrationId)).toMatchObject({ narrationId: created.narrationId });
    await repository.markFallback(created.narrationId, { schemaVersion: 1, headline: "제목", body: "본문", bullets: [] });
    expect(await repository.retry(created.narrationId)).toMatchObject({ narrationId: created.narrationId });
    await repository.markFallback(created.narrationId, { schemaVersion: 1, headline: "제목", body: "본문", bullets: [] });
    expect(await repository.retry(created.narrationId)).toBeNull();
    await expect(createPrismaNarrationRepository(prisma as never, { userId: "other-user", timezone: "Asia/Seoul" }).retry(created.narrationId)).resolves.toBeNull();
  });
});
