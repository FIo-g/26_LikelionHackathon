import type { TransactionClient } from "@/shared/db/transaction";
import type { UserScope, VersionedPayload } from "@/shared/domain/contracts";
import { assertJsonSize } from "@/shared/validation/versioned-json";
import { readNarrationEnvironment } from "./openai-narration-provider";
import type { NarrationRepository } from "../application/ports";
import { buildTemplateNarration } from "../domain/build-template-narration";
import type { NarrationFacts, NarrationOutput, NarrationTarget } from "../domain/types";

type NarrationWhere = Readonly<{
  id?: string;
  userId?: string;
  status?: string;
  retryCount?: number;
  generatedAt?: Readonly<{ lte: Date }>;
  analysisSnapshotId?: string | null;
  scheduleAdviceId?: string | null;
}>;

type NarrationRow = Readonly<{
  id: string;
  facts: NarrationFacts;
  retryCount: number;
  status?: "pending" | "ready" | "template-fallback";
  output?: VersionedPayload<NarrationOutput> | null;
}>;

type NarrationClient = {
  narration: {
    create: (args: Readonly<{ data: Record<string, unknown> }>) => Promise<{ id: string }>;
    findFirst: (args: Readonly<{ where: NarrationWhere }>) => Promise<NarrationRow | null>;
    findMany: (args: Readonly<{ where: NarrationWhere }>) => Promise<readonly NarrationRow[]>;
    updateMany: (args: Readonly<{ where: NarrationWhere; data: Record<string, unknown> }>) => Promise<{ count: number }>;
  };
};

const STALE_PENDING_MS = 30_000;
const MAX_RETRIES = 2;

const assertExclusiveTarget = (target: NarrationTarget): void => {
  const targetCount = Number(target.analysisSnapshotId !== null) + Number(target.scheduleAdviceId !== null);
  if (targetCount !== 1) throw new Error("INVALID_NARRATION_TARGET");
};

const isUniqueError = (error: unknown): boolean => (
  typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
);

const targetWhere = (target: NarrationTarget): NarrationWhere => (
  target.analysisSnapshotId !== null
    ? { analysisSnapshotId: target.analysisSnapshotId }
    : { scheduleAdviceId: target.scheduleAdviceId }
);

export const createPrismaNarrationRepository = (
  db: TransactionClient,
  scope: UserScope,
): NarrationRepository => {
  const client = db as TransactionClient & NarrationClient;

  return {
    createPending: async (target, inputHash, facts) => {
      assertExclusiveTarget(target);
      const existing = await client.narration.findFirst({ where: { userId: scope.userId, ...targetWhere(target) } });
      if (existing) return { narrationId: existing.id, created: false };
      const environment = readNarrationEnvironment();
      try {
        const saved = await client.narration.create({
          data: {
            userId: scope.userId,
            analysisSnapshotId: target.analysisSnapshotId,
            scheduleAdviceId: target.scheduleAdviceId,
            provider: "openai",
            model: environment?.model ?? null,
            inputHash,
            facts,
            status: "pending",
            retryCount: 0,
          },
        });
        return { narrationId: saved.id, created: true };
      } catch (error) {
        if (!isUniqueError(error)) throw error;
        const concurrent = await client.narration.findFirst({ where: { userId: scope.userId, ...targetWhere(target) } });
        if (!concurrent) throw error;
        return { narrationId: concurrent.id, created: false };
      }
    },
    markReady: async (narrationId, output) => {
      assertJsonSize(output);
      await client.narration.updateMany({
        where: { id: narrationId, userId: scope.userId, status: "pending" },
        data: { status: "ready", output },
      });
    },
    markFallback: async (narrationId, output) => {
      assertJsonSize(output);
      await client.narration.updateMany({
        where: { id: narrationId, userId: scope.userId, status: "pending" },
        data: { status: "template-fallback", output },
      });
    },
    recoverStalePending: async (now) => {
      const cutoff = new Date(now.getTime() - STALE_PENDING_MS);
      const stale = await client.narration.findMany({
        where: { userId: scope.userId, status: "pending", generatedAt: { lte: cutoff } },
      });
      const recovered = await Promise.all(stale.map(async (row) => {
        const output = { schemaVersion: 1 as const, ...buildTemplateNarration(row.facts) };
        assertJsonSize(output);
        const updated = await client.narration.updateMany({
          where: { id: row.id, userId: scope.userId, status: "pending", generatedAt: { lte: cutoff } },
          data: { status: "template-fallback", output },
        });
        return updated.count;
      }));
      return recovered.reduce((total, count) => total + count, 0);
    },
    retry: async (narrationId) => {
      const current = await client.narration.findFirst({
        where: { id: narrationId, userId: scope.userId, status: "template-fallback" },
      });
      if (!current || current.retryCount >= MAX_RETRIES) return null;
      const updated = await client.narration.updateMany({
        where: { id: narrationId, userId: scope.userId, status: "template-fallback", retryCount: current.retryCount },
        data: { status: "pending", retryCount: { increment: 1 }, output: null, generatedAt: new Date() },
      });
      return updated.count === 1 ? { narrationId, facts: current.facts } : null;
    },
    findForAnalysisSnapshot: async (analysisSnapshotId) => {
      const row = await client.narration.findFirst({
        where: { userId: scope.userId, analysisSnapshotId },
      });
      if (!row || !row.status) return null;
      return {
        id: row.id,
        status: row.status,
        retryCount: row.retryCount,
        output: row.output ?? null,
      };
    },
  };
};

export type StoredNarrationOutput = VersionedPayload<NarrationOutput>;
