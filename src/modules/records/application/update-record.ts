import type { RecordService } from "./record-service";
import type { RecordMutationResult, UpdateRecordCommand } from "./record-service";

export const updateRecord = async (
  service: RecordService,
  command: UpdateRecordCommand,
): Promise<RecordMutationResult> => (
  service.update(command)
);
