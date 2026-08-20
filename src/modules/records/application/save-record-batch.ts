import type { RecordService } from "./record-service";
import type { BatchRecordMutationResult, SaveRecordBatchCommand } from "./record-service";

export const saveRecordBatch = async (
  service: RecordService,
  command: SaveRecordBatchCommand,
): Promise<BatchRecordMutationResult> => (
  service.saveBatch(command)
);
