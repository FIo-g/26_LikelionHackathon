import type { ConfidenceLevel, UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import type { Evidence } from "@/shared/domain/contracts";
import type {
  AnalysisResult,
  NormalizedAnalysisInput,
  SleepImpactFactor,
} from "../domain/types";

export type AnalysisSnapshotStatus = "current" | "superseded";

export type CorruptAnalysisSnapshotFailure = Readonly<{
  code: "CORRUPT_ANALYSIS_SNAPSHOT";
  snapshotId: string;
}>

export type ParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; failure: CorruptAnalysisSnapshotFailure }>;

export type AnalysisSnapshotEntity = Readonly<{
  id: string;
  localDate: string;
  timezone: string;
  status: AnalysisSnapshotStatus;
  result: AnalysisResult;
  generatedAt: Date;
  supersededAt: Date | null;
}>;

export type BaselineSnapshotEntity = Readonly<{
  id: string;
  timezone: string;
  status: AnalysisSnapshotStatus;
  result: unknown;
  generatedAt: Date;
  supersededAt: Date | null;
}>;

export type ImpactFactorEntity = Readonly<{
  factor: SleepImpactFactor;
  exposedCount: number;
  unexposedCount: number;
  deltaMinutes: number | null;
  confidence: ConfidenceLevel;
  evidence: readonly Evidence[];
}>;

export interface AnalysisRepository {
  loadWindow(localDate: string, days: 14): Promise<NormalizedAnalysisInput>;
  supersedeCurrent(localDate: string, at: Date): Promise<void>;
  saveCurrent(localDate: string, result: AnalysisResult, impactFactors: readonly ImpactFactorEntity[]): Promise<{ snapshotId: string }>;
  findCurrent(localDate: string): Promise<ParseResult<AnalysisSnapshotEntity> | null>;
  findLastSuccessful(localDate: string): Promise<ParseResult<AnalysisSnapshotEntity> | null>;
}

export type AnalysisRepositoryFactory = (
  tx: TransactionClient,
  scope: UserScope,
  options?: Readonly<{ now: () => Date }>,
) => AnalysisRepository;

