import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";

import type { CreateMutationReceiptRepository } from "@/modules/records/application/ports";
import { createMutationReceiptRepository } from "@/modules/records/infrastructure/prisma-mutation-receipt-repository";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { systemClock } from "@/shared/time/system-clock";
import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import { generateNarration, type NarrationDependencies, type NarrationRequest } from "@/modules/narration/application/generate-narration";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import { buildAdviceNarrationFacts } from "@/modules/narration/domain/types";
import { createOpenAiNarrationProvider } from "@/modules/narration/infrastructure/openai-narration-provider";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";
import { createPlannerInputHash, generateScheduleProposal } from "../domain/generate-schedule-proposal";
import type { ScheduleProposal } from "../domain/types";
import { createPrismaPlannerRepository } from "../infrastructure/prisma-planner-repository";
import type { CreatePlannerRepository } from "./ports";

export type CreateScheduleAdviceCommand = Readonly<{
  idempotencyKey: string;
  title: string;
  type: string;
  startsAt: string;
  desiredWakeAt: string | null;
  notes: string | null;
}>;

export type CreateScheduleAdviceResult = Readonly<{
  eventId: string;
  adviceId: string;
  proposal: ScheduleProposal;
}>;

export interface ScheduleAdviceService {
  createScheduleAdvice(command: CreateScheduleAdviceCommand): Promise<CreateScheduleAdviceResult>;
}

type TransactionRunner = Readonly<{
  $transaction: <T>(callback: (transaction: TransactionClient) => Promise<T>) => Promise<T>;
}>;

type CreateNarrationRepository = (db: TransactionClient, scope: UserScope) => NarrationRepository;

const hasNarrationModel = (value: TransactionClient | undefined): value is TransactionClient & { narration: object } => (
  value !== undefined && "narration" in value
);

const commandSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(40),
  startsAt: z.string().datetime({ offset: true }),
  desiredWakeAt: z.string().datetime({ offset: true }).nullable(),
  notes: z.string().max(500).nullable(),
}).strict();

const validateTiming = (command: z.infer<typeof commandSchema>, clock: Clock): void => {
  const eventAt = Temporal.Instant.from(command.startsAt);
  const now = Temporal.Instant.from(clock.now().toISOString());
  const maximum = now.add({ hours: 365 * 24 });

  if (Temporal.Instant.compare(eventAt, now) <= 0 || Temporal.Instant.compare(eventAt, maximum) > 0) {
    throw new Error("INVALID_EVENT_START");
  }

  if (!command.desiredWakeAt) {
    return;
  }

  const wakeAt = Temporal.Instant.from(command.desiredWakeAt);
  const leadMs = eventAt.epochMilliseconds - wakeAt.epochMilliseconds;
  if (leadMs <= 0 || leadMs > 24 * 60 * 60 * 1000) {
    throw new Error("INVALID_DESIRED_WAKE");
  }
};

export const createScheduleAdviceService = (
  scope: UserScope,
  dependencies: Readonly<{
    clock?: Clock;
    getPrisma?: () => TransactionRunner;
    executeTransaction?: <T>(work: (transaction?: TransactionClient) => Promise<T>) => Promise<T>;
    createPlannerRepository?: CreatePlannerRepository;
    createMutationReceiptRepository?: CreateMutationReceiptRepository;
    narrationDependencies?: NarrationDependencies | null;
    createNarrationRepository?: CreateNarrationRepository;
  }> = {},
): ScheduleAdviceService => {
  const clock = dependencies.clock ?? systemClock;
  const getPrisma = dependencies.getPrisma ?? (() => getPrismaClient() as TransactionRunner);
  const plannerRepositoryFactory = dependencies.createPlannerRepository ?? createPrismaPlannerRepository;
  const receiptRepositoryFactory = dependencies.createMutationReceiptRepository ?? createMutationReceiptRepository;
  const narrationRepositoryFactory = dependencies.createNarrationRepository ?? createPrismaNarrationRepository;

  return {
    createScheduleAdvice: async (command) => {
      const parsed = commandSchema.parse(command);
      validateTiming(parsed, clock);
      const fixedNow = clock.now();
      const fixedClock: Clock = { now: () => fixedNow };
      const requestHash = hashCanonicalJson({ operation: "planner.createScheduleAdvice", ...parsed });
      const executeTransaction = dependencies.executeTransaction
        ?? ((work) => getPrisma().$transaction((transaction) => work(transaction)));

      const committed = await executeTransaction(async (transaction) => {
        const plannerRepository = plannerRepositoryFactory(transaction as TransactionClient, scope);
        const receipts = receiptRepositoryFactory(transaction as TransactionClient, scope, fixedClock);
        const narrationRepository: NarrationRepository | null = hasNarrationModel(transaction)
          ? narrationRepositoryFactory(transaction, scope)
          : null;

        const result = await receipts.execute({
          operation: "planner.createScheduleAdvice",
          idempotencyKey: parsed.idempotencyKey,
          requestHash,
        }, async () => {
          const [goal, baseline] = await Promise.all([
            plannerRepository.findCurrentGoal(),
            plannerRepository.findCurrentBaseline(),
          ]);
          if (!goal) {
            throw new Error("MISSING_SLEEP_GOAL");
          }

          const eventInput = {
            title: parsed.title,
            type: parsed.type,
            startsAt: parsed.startsAt,
            desiredWakeAt: parsed.desiredWakeAt,
            notes: parsed.notes,
            timezone: scope.timezone,
          };
          const event = await plannerRepository.createEvent(eventInput);
          const proposal = generateScheduleProposal({
            timezone: scope.timezone,
            goal,
            baseline,
            event: { ...eventInput, id: event.eventId },
          });
          const inputSnapshot = {
            schemaVersion: 1 as const,
            timezone: scope.timezone,
            goal,
            baselineId: baseline?.id ?? null,
            event: {
              id: event.eventId,
              type: parsed.type,
              startsAt: parsed.startsAt,
              desiredWakeAt: parsed.desiredWakeAt,
            },
            planId: null,
            triggerRecordId: null,
          };
          const saved = await plannerRepository.saveGeneratedAdvice({
            eventId: event.eventId,
            planId: null,
            triggerType: "event",
            inputHash: createPlannerInputHash(inputSnapshot),
            inputSnapshot,
            proposal,
          });

          return { eventId: event.eventId, adviceId: saved.adviceId, proposal };
        });
        const facts = buildAdviceNarrationFacts(result.adviceId, result.proposal, { type: parsed.type, startsAt: parsed.startsAt });
        const pendingNarration: NarrationRequest[] = narrationRepository
          ? await narrationRepository.createPending(
            { analysisSnapshotId: null, scheduleAdviceId: result.adviceId },
            hashCanonicalJson(facts),
            facts,
          ).then(({ narrationId, created }) => created ? [{ narrationId, facts }] : [])
          : [];
        return { result, pendingNarration };
      });
      const narrationDependencies = dependencies.narrationDependencies
        ?? (hasNarrationModel(getPrisma() as TransactionClient)
          ? { provider: createOpenAiNarrationProvider(), repository: narrationRepositoryFactory(getPrisma() as TransactionClient, scope) }
          : null);
      if (narrationDependencies) {
        await Promise.allSettled(committed.pendingNarration.map((request) => generateNarration(request, narrationDependencies)));
      }
      return committed.result;
    },
  };
};
