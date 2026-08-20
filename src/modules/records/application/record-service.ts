import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import { wakeLocalDate } from "@/shared/time/local-date";
import { systemClock } from "@/shared/time/system-clock";
import { recalculateAnalysis } from "@/modules/analysis/application/recalculate-analysis";
import type { AnalysisRepositoryFactory } from "@/modules/analysis/application/ports";
import { evaluateRerouting, type ReroutingMutation } from "@/modules/planner/application/evaluate-rerouting";
import type { CreatePlannerRepository } from "@/modules/planner/application/ports";
import { createPrismaPlannerRepository } from "@/modules/planner/infrastructure/prisma-planner-repository";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import { getPrismaClient } from "@/shared/db/prisma";
import {
  MutationReceiptRaceError,
  type CreateMutationReceiptRepository,
  type CreateRecordRepository,
  type RecordRepository,
} from "./ports";
import { createMutationReceiptRepository } from "../infrastructure/prisma-mutation-receipt-repository";
import { createRecordRepository } from "../infrastructure/prisma-record-repository";
import {
  buildRecordTypeSchema,
  parseCreateRecordInput,
  parseUpdateRecordInput,
} from "../domain/schemas";
import { affectedAnalysisDates } from "./affected-analysis-dates";
import type { CreateRecordInput, RecordType, UpdateRecordInput } from "../domain/types";
import { serializeRecordPayload } from "../infrastructure/prisma-record-repository";
import { generateNarration, type NarrationDependencies, type NarrationRequest } from "@/modules/narration/application/generate-narration";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import { createOpenAiNarrationProvider } from "@/modules/narration/infrastructure/openai-narration-provider";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";

export interface RecordMutationResult {
  recordId: string;
  recordType: RecordType;
  localDate: string;
  affectedLocalDates: readonly string[];
}

export type CreateRecordCommand = Readonly<{
  idempotencyKey: string;
  input: CreateRecordInput;
}>;

export type UpdateRecordCommand = Readonly<{
  idempotencyKey: string;
  recordId: string;
  input: UpdateRecordInput;
}>;

export type DeleteRecordCommand = Readonly<{
  idempotencyKey: string;
  recordId: string;
  recordType: RecordType;
}>;

export type SaveRecordItem = Readonly<{
  clientKey: string;
  recordId: string | null;
  input: CreateRecordInput;
}>;

export type SaveRecordBatchCommand = Readonly<{
  idempotencyKey: string;
  items: readonly SaveRecordItem[];
}>;

export type DeleteRecordBatchCommand = Readonly<{
  idempotencyKey: string;
  items: readonly {
    recordId: string;
    recordType: RecordType;
  }[];
}>;

export type BatchRecordMutationResult = Readonly<{
  records: readonly { clientKey: string; recordId: string; recordType: RecordType; localDate: string }[];
  affectedLocalDates: readonly string[];
}>;

export interface RecordService {
  create(command: CreateRecordCommand): Promise<RecordMutationResult>;
  update(command: UpdateRecordCommand): Promise<RecordMutationResult>;
  delete(command: DeleteRecordCommand): Promise<RecordMutationResult>;
  saveBatch(command: SaveRecordBatchCommand): Promise<BatchRecordMutationResult>;
  deleteBatch(command: DeleteRecordBatchCommand): Promise<BatchRecordMutationResult>;
}

type TransactionRunner = Readonly<{
  $transaction: <T>(callback: (tx: TransactionClient) => Promise<T>) => Promise<T>;
}>;

type CreateNarrationRepository = (db: TransactionClient, scope: UserScope) => NarrationRepository;

const hasNarrationModel = (value: TransactionClient): value is TransactionClient & { narration: object } => (
  "narration" in value
);

export type RecordActionState =
  | { status: "error"; values: Record<string, string>; fieldErrors: Record<string, string[]>; timeChoices?: readonly { field: string; offsetMinutes: number; label: string }[] }
  | { status: "success"; recordId: string };

const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 7;
const recordTypeSchema = buildRecordTypeSchema();

const ensureRecordType = (value: string): RecordType => {
  const parsed = recordTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("INVALID_RECORD_TYPE");
  }

  return parsed.data;
};

const collectAffectedDates = (
  impacted: Set<string>,
  localDate: string,
  scope: UserScope,
  clock: Clock,
): void => {
  const currentLocalDate = wakeLocalDate(clock.now(), scope.timezone);
  const endLocalDate = localDate <= currentLocalDate ? currentLocalDate : localDate;
  const affected = affectedAnalysisDates(localDate, endLocalDate);
  for (const date of affected) {
    impacted.add(date);
  }
};

const sortAffectedDates = (dates: Iterable<string>): string[] => [...dates].sort();

const normalizeReceiptValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeReceiptValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeReceiptValue(item)]),
    );
  }
  return value;
};

const normalizeSaveBatchItems = (clock: Clock, command: SaveRecordBatchCommand): SaveRecordItem[] => {
  if (command.items.length < MIN_BATCH_SIZE || command.items.length > MAX_BATCH_SIZE) {
    throw new Error("INVALID_BATCH_SIZE");
  }

  const seen = new Set<string>();

  return command.items.map((item) => {
    if (!item.clientKey) {
      throw new Error("INVALID_CLIENT_KEY");
    }

    if (seen.has(item.clientKey)) {
      throw new Error("DUPLICATE_CLIENT_KEY");
    }

    seen.add(item.clientKey);

    return {
      clientKey: item.clientKey,
      recordId: item.recordId ?? null,
      input: parseCreateRecordInput(clock, item.input),
    };
  });
};

const normalizeDeleteBatchItems = (command: DeleteRecordBatchCommand): DeleteRecordBatchCommand["items"] => (
  command.items.map((item) => ({
    recordId: item.recordId,
    recordType: ensureRecordType(item.recordType),
  }))
);

const executeSaveMutationWithoutReceipt = async (
  scope: UserScope,
  items: readonly SaveRecordItem[],
  repositories: { recordRepository: RecordRepository },
  clock: Clock,
): Promise<BatchRecordMutationResult> => {
  const impacted = new Set<string>();
  const records: Array<{ clientKey: string; recordId: string; recordType: RecordType; localDate: string }> = [];
  const changedAt = clock.now();

  for (const item of items) {
    if (item.recordId === null) {
      const created = await repositories.recordRepository.create(item.input.type, item.input);
      collectAffectedDates(impacted, created.localDate, scope, clock);
      await repositories.recordRepository.appendRevision({
        entityType: created.type,
        entityId: created.id,
        operation: "create",
        before: null,
        after: serializeRecordPayload(created),
        changedAt,
      });

      records.push({
        clientKey: item.clientKey,
        recordId: created.id,
        recordType: created.type,
        localDate: created.localDate,
      });

      continue;
    }

    const existing = await repositories.recordRepository.findById(item.input.type, item.recordId);
    if (!existing) {
      throw new Error("RECORD_NOT_FOUND");
    }

    const before = serializeRecordPayload(existing);
    const updated = await repositories.recordRepository.update(item.input.type, item.recordId, item.input);
    collectAffectedDates(impacted, existing.localDate, scope, clock);
    collectAffectedDates(impacted, updated.localDate, scope, clock);
    await repositories.recordRepository.appendRevision({
      entityType: updated.type,
      entityId: updated.id,
      operation: "update",
      before,
      after: serializeRecordPayload(updated),
      changedAt,
    });

    records.push({
      clientKey: item.clientKey,
      recordId: updated.id,
      recordType: updated.type,
      localDate: updated.localDate,
    });
  }

  return {
    records,
    affectedLocalDates: sortAffectedDates(impacted),
  };
};

const executeDeleteMutationWithoutReceipt = async (
  scope: UserScope,
  items: readonly { recordId: string; recordType: RecordType }[],
  repositories: { recordRepository: RecordRepository },
  clock: Clock,
): Promise<BatchRecordMutationResult> => {
  const impacted = new Set<string>();
  const records: Array<{ clientKey: string; recordId: string; recordType: RecordType; localDate: string }> = [];
  const snapshots = [] as Array<{ type: RecordType; id: string; before: ReturnType<typeof serializeRecordPayload>; localDate: string }>;

  for (const item of items) {
    const found = await repositories.recordRepository.findById(item.recordType, item.recordId);
    if (!found) {
      throw new Error("RECORD_NOT_FOUND");
    }

    snapshots.push({
      type: item.recordType,
      id: found.id,
      before: serializeRecordPayload(found),
      localDate: found.localDate,
    });
  }

  const changedAt = clock.now();
  for (const snapshot of snapshots) {
    collectAffectedDates(impacted, snapshot.localDate, scope, clock);
    await repositories.recordRepository.delete(snapshot.type, snapshot.id);
    await repositories.recordRepository.appendRevision({
      entityType: snapshot.type,
      entityId: snapshot.id,
      operation: "delete",
      before: snapshot.before,
      after: null,
      changedAt,
    });

    records.push({
      clientKey: `${snapshot.type}:${snapshot.id}`,
      recordId: snapshot.id,
      recordType: snapshot.type,
      localDate: snapshot.localDate,
    });
  }

  return {
    records,
    affectedLocalDates: sortAffectedDates(impacted),
  };
};

export const createRecordService = (
  scope: UserScope,
  dependencies?: Readonly<{
    clock?: Clock;
    getPrisma?: () => TransactionRunner;
    analysisRepositoryFactory?: AnalysisRepositoryFactory;
    plannerRepositoryFactory?: CreatePlannerRepository;
    recordRepositoryFactory?: CreateRecordRepository;
    mutationReceiptRepositoryFactory?: CreateMutationReceiptRepository;
    narrationDependencies?: NarrationDependencies | null;
    narrationRepositoryFactory?: CreateNarrationRepository;
  }>,
): RecordService => {
  const clock = dependencies?.clock ?? systemClock;
  const getPrisma = dependencies?.getPrisma ?? getPrismaClient;
  const analysisRepositoryFactory = dependencies?.analysisRepositoryFactory;
  const plannerRepositoryFactory = dependencies?.plannerRepositoryFactory ?? createPrismaPlannerRepository;
  const recordRepositoryFactory = dependencies?.recordRepositoryFactory ?? createRecordRepository;
  const mutationReceiptRepositoryFactory = dependencies?.mutationReceiptRepositoryFactory ?? createMutationReceiptRepository;
  const narrationRepositoryFactory = dependencies?.narrationRepositoryFactory ?? createPrismaNarrationRepository;

  const runWithReceipt = async (
    operation: string,
    idempotencyKey: string,
    normalizedCommand: unknown,
    runner: (repositories: {
      recordRepository: RecordRepository;
    }, fixedClock: Clock) => Promise<BatchRecordMutationResult>,
  ): Promise<BatchRecordMutationResult> => {
    const now = clock.now();
    const fixedClock: Clock = { now: () => now };

    const requestHash = hashCanonicalJson({
      operation,
      idempotencyKey,
      command: normalizeReceiptValue(normalizedCommand),
    });
    const receiptCommand = { operation, idempotencyKey, requestHash };

    const prisma = getPrisma() as TransactionRunner;

    let committed: { result: BatchRecordMutationResult; pendingNarration: NarrationRequest[] };
    try {
      committed = await prisma.$transaction(async (tx) => {
        const recordRepository = recordRepositoryFactory(tx, scope);
        const analysisRepository = analysisRepositoryFactory
          ? analysisRepositoryFactory(tx, scope, { now: fixedClock.now })
          : null;
        const mutationReceiptRepository = mutationReceiptRepositoryFactory(tx, scope, fixedClock);
        const narrationRepository: NarrationRepository | null = hasNarrationModel(tx)
          ? narrationRepositoryFactory(tx, scope)
          : null;
        const pendingNarration: NarrationRequest[] = [];

        const result = await mutationReceiptRepository.execute(receiptCommand, async () => {
          const mutationResult = await runner({ recordRepository }, fixedClock);

          if (analysisRepository) {
            const recalculated = await recalculateAnalysis(analysisRepository, mutationResult.affectedLocalDates, fixedClock, narrationRepository);
            pendingNarration.push(...recalculated.flatMap((snapshot) => snapshot.pendingNarration ? [snapshot.pendingNarration] : []));
          }

          if ("sleepPlan" in tx) {
            const plannerRepository = plannerRepositoryFactory(tx, scope);
            const rerouteMutations: ReroutingMutation[] = (await recordRepository.listOwnedRecords()).map((record) => {
              const input = Object.fromEntries(
                Object.entries(record).filter(([key]) => key !== "id" && key !== "userId" && key !== "localDate"),
              ) as CreateRecordInput;
              return { recordId: record.id, input };
            });
            const reroute = await evaluateRerouting(scope, plannerRepository, rerouteMutations, { clock: fixedClock, narrationRepository });
            if (reroute?.pendingNarration) pendingNarration.push(reroute.pendingNarration);
          }

          return mutationResult;
        });
        return { result, pendingNarration };
      });
    } catch (error) {
      if (!(error instanceof MutationReceiptRaceError) && (error as { code?: string })?.code !== "MUTATION_RECEIPT_RACE") {
        throw error;
      }

      const outerReceipts = mutationReceiptRepositoryFactory(
        getPrisma() as TransactionClient,
        scope,
        fixedClock,
      );
      if (!outerReceipts.resolve) {
        throw error;
      }
      committed = {
        result: await outerReceipts.resolve<BatchRecordMutationResult>(receiptCommand),
        pendingNarration: [],
      };
    }
    const narrationDependencies = dependencies?.narrationDependencies
      ?? (hasNarrationModel(getPrisma() as TransactionClient)
        ? { provider: createOpenAiNarrationProvider(), repository: narrationRepositoryFactory(getPrisma() as TransactionClient, scope) }
        : null);
    if (narrationDependencies) {
      await Promise.allSettled(committed.pendingNarration.map((request) => generateNarration(request, narrationDependencies)));
    }
    return committed.result;
  };

  const saveBatch = async (command: SaveRecordBatchCommand): Promise<BatchRecordMutationResult> => {
    const normalizedItems = normalizeSaveBatchItems(clock, command);

    return runWithReceipt("record.saveBatch", command.idempotencyKey, { items: normalizedItems }, async ({ recordRepository }, fixedClock) => (
      executeSaveMutationWithoutReceipt(scope, normalizedItems, { recordRepository }, fixedClock)
    ));
  };

  const deleteBatch = async (command: DeleteRecordBatchCommand): Promise<BatchRecordMutationResult> => {
    const normalizedItems = normalizeDeleteBatchItems(command);

    return runWithReceipt("record.deleteBatch", command.idempotencyKey, { items: normalizedItems }, async ({ recordRepository }, fixedClock) => (
      executeDeleteMutationWithoutReceipt(scope, normalizedItems, { recordRepository }, fixedClock)
    ));
  };

  const create = async (command: CreateRecordCommand): Promise<RecordMutationResult> => {
    const parsedInput = parseCreateRecordInput(clock, command.input);
    const request = {
      idempotencyKey: command.idempotencyKey,
      items: [{
        clientKey: "record",
        recordId: null,
        input: parsedInput,
      }],
    };

    const result = await runWithReceipt("record.create", command.idempotencyKey, { input: parsedInput }, async ({ recordRepository }, fixedClock) => (
      executeSaveMutationWithoutReceipt(
        scope,
        request.items,
        { recordRepository },
        fixedClock,
      )
    ));

    const first = result.records[0];
    if (!first) {
      throw new Error("UNEXPECTED_EMPTY_BATCH");
    }

    return {
      recordId: first.recordId,
      recordType: first.recordType,
      localDate: first.localDate,
      affectedLocalDates: result.affectedLocalDates,
    };
  };

  const update = async (command: UpdateRecordCommand): Promise<RecordMutationResult> => {
    const parsedInput = parseUpdateRecordInput(clock, command.input);
    const request = {
      idempotencyKey: command.idempotencyKey,
      items: [{
        clientKey: "record",
        recordId: command.recordId,
        input: parsedInput,
      }],
    };

    const result = await runWithReceipt("record.update", command.idempotencyKey, { recordId: command.recordId, input: parsedInput }, async ({ recordRepository }, fixedClock) => (
      executeSaveMutationWithoutReceipt(
        scope,
        request.items,
        { recordRepository },
        fixedClock,
      )
    ));

    const first = result.records[0];
    if (!first) {
      throw new Error("UNEXPECTED_EMPTY_BATCH");
    }

    return {
      recordId: first.recordId,
      recordType: first.recordType,
      localDate: first.localDate,
      affectedLocalDates: result.affectedLocalDates,
    };
  };

  const remove = async (command: DeleteRecordCommand): Promise<RecordMutationResult> => {
    const parsedType = ensureRecordType(command.recordType);
    const request = {
      idempotencyKey: command.idempotencyKey,
      items: [{
        recordId: command.recordId,
        recordType: parsedType,
      }],
    };

    const result = await runWithReceipt("record.delete", command.idempotencyKey, { recordId: command.recordId, recordType: parsedType }, async ({ recordRepository }, fixedClock) => (
      executeDeleteMutationWithoutReceipt(
        scope,
        request.items,
        { recordRepository },
        fixedClock,
      )
    ));

    const first = result.records[0];
    if (!first) {
      throw new Error("UNEXPECTED_EMPTY_BATCH");
    }

    return {
      recordId: first.recordId,
      recordType: first.recordType,
      localDate: first.localDate,
      affectedLocalDates: result.affectedLocalDates,
    };
  };

  return {
    create,
    update,
    delete: remove,
    saveBatch,
    deleteBatch,
  };
};
