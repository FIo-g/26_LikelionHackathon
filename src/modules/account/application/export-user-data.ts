import type { Clock, UserScope } from "@/shared/domain/contracts";
import type { UserDataExport } from "../domain/export-schema";

export interface AccountDataExportRepository {
  load(scope: UserScope): Promise<Omit<UserDataExport, "schemaVersion" | "exportedAt">>;
}

export type ExportUserData = (scope: UserScope) => Promise<UserDataExport>;

export const createExportUserData = (
  repository: AccountDataExportRepository,
  clock: Clock,
): ExportUserData => async (scope) => ({
  schemaVersion: 1,
  exportedAt: clock.now().toISOString(),
  ...(await repository.load(scope)),
});
