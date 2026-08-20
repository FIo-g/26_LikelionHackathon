import type { BatchRecordMutationResult, DeleteRecordBatchCommand, RecordService } from "./record-service";

export const deleteRecordBatch = async (
  service: RecordService,
  command: DeleteRecordBatchCommand,
): Promise<BatchRecordMutationResult> => (
  service.deleteBatch(command)
);
