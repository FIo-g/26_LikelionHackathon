import type { DeleteRecordCommand, RecordMutationResult } from "./record-service";
import type { RecordService } from "./record-service";

export const deleteRecord = async (
  service: RecordService,
  command: DeleteRecordCommand,
): Promise<RecordMutationResult> => (
  service.delete(command)
);
