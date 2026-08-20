import type { RecordService } from "./record-service";
import type { CreateRecordCommand, RecordMutationResult } from "./record-service";

export const createRecord = async (
  service: RecordService,
  command: CreateRecordCommand,
): Promise<RecordMutationResult> => (
  service.create(command)
);
