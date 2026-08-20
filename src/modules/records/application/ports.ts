import type { Clock, UserScope, VersionedPayload } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import type { CreateRecordInput, RecordEntity, RecordType, SerializedRecord, UpdateRecordInput } from "../domain/types";

export type RecordRevisionInput = Readonly<{
  entityType: RecordType;
  entityId: string;
  operation: "create" | "update" | "delete";
  before: VersionedPayload<{ record: SerializedRecord }> | null;
  after: VersionedPayload<{ record: SerializedRecord }> | null;
  changedAt: Date;
}>;

export interface RecordRepository {
  findById(type: RecordType, id: string): Promise<RecordEntity | null>;
  listOwnedRecords(): Promise<readonly RecordEntity[]>;
  create(type: RecordType, input: CreateRecordInput): Promise<RecordEntity>;
  update(type: RecordType, id: string, input: UpdateRecordInput): Promise<RecordEntity>;
  delete(type: RecordType, id: string): Promise<void>;
  appendRevision(input: RecordRevisionInput): Promise<void>;
}

export type MutationReceiptCommand = Readonly<{
  operation: string;
  idempotencyKey: string;
  requestHash: string;
}>;

export interface MutationReceiptRepository {
  execute<T>(command: MutationReceiptCommand, work: () => Promise<T>): Promise<T>;
}

export type CreateRecordRepository = (db: TransactionClient, scope: UserScope) => RecordRepository;
export type CreateMutationReceiptRepository = (
  db: TransactionClient,
  scope: UserScope,
  clock: Clock,
) => MutationReceiptRepository;
