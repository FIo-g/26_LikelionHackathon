import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { scheduleProposalSchema } from "@/modules/planner/domain/schemas";
import type { TransactionClient } from "@/shared/db/transaction";
import type { UserScope, VersionedPayload } from "@/shared/domain/contracts";
import { JsonContractError } from "@/shared/validation/errors";
import { assertJsonSize, versionedPayloadSchema } from "@/shared/validation/versioned-json";
import { readNarrationEnvironment } from "./openai-narration-provider";
import type { NarrationRepository } from "../application/ports";
import { buildTemplateNarration } from "../domain/build-template-narration";
import { narrationOutputSchema } from "../domain/narration-schema";
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

const STALE_PENDING_MS = 30_000;
const MAX_RETRIES = 2;
const narrationStatusSchema = z.enum(["pending", "ready", "template-fallback"]);
const narrationFactsSchema: z.ZodType<NarrationFacts> = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("analysis"), id: z.string().min(1) }).strict(),
    z.object({ kind: z.literal("advice"), id: z.string().min(1) }).strict(),
  ]),
  algorithmVersion: z.literal("provisional-v1"),
  metrics: z.array(z.object({ id: z.string().min(1), value: z.number().finite().nullable(), band: z.string().min(1) }).strict()),
  dataBasis: z.object({
    periodStart: z.string(),
    periodEnd: z.string(),
    sampleCount: z.number().int().min(0),
    excludedCount: z.number().int().min(0),
    missingFields: z.array(z.string()),
    sourceDistribution: z.object({ manual: z.number().int().min(0) }).strict(),
  }).strict(),
  evidence: z.array(z.object({
    code: z.string().min(1),
    direction: z.enum(["positive", "negative", "neutral"]),
    count: z.number().int().min(0).nullable(),
  }).strict()),
  event: z.object({ type: z.string().min(1), startsAt: z.string().min(1) }).strict().nullable(),
  proposal: scheduleProposalSchema.nullable(),
  confidence: z.enum(["insufficient", "low", "medium", "high"]),
}).strict();
const narrationOutputEnvelopeSchema = versionedPayloadSchema(narrationOutputSchema.shape);

const parseStoredJson = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new JsonContractError("INVALID_JSON_VALUE");
  return parsed.data;
};

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
  const client = db;

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
        const facts = parseStoredJson(narrationFactsSchema, row.facts);
        const output = { schemaVersion: 1 as const, ...buildTemplateNarration(facts) };
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
      const facts = parseStoredJson(narrationFactsSchema, current.facts);
      const updated = await client.narration.updateMany({
        where: { id: narrationId, userId: scope.userId, status: "template-fallback", retryCount: current.retryCount },
        data: { status: "pending", retryCount: { increment: 1 }, output: Prisma.DbNull, generatedAt: new Date() },
      });
      return updated.count === 1 ? { narrationId, facts } : null;
    },
    findForAnalysisSnapshot: async (analysisSnapshotId) => {
      const row = await client.narration.findFirst({
        where: { userId: scope.userId, analysisSnapshotId },
      });
      if (!row) return null;
      const status = parseStoredJson(narrationStatusSchema, row.status);
      const output = row.output === null ? null : parseStoredJson(narrationOutputEnvelopeSchema, row.output);
      return {
        id: row.id,
        status,
        retryCount: row.retryCount,
        output,
      };
    },
  };
};

export type StoredNarrationOutput = VersionedPayload<NarrationOutput>;
