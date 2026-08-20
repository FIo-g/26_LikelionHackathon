import type { ConfidenceLevel, UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import type { Evidence } from "@/shared/domain/contracts";
import type {
  AnalysisResult,
  BaselineResult,
  NormalizedAnalysisInput,
  SleepImpactFactor,
} from "../domain/types";

export type AnalysisSnapshotStatus = "current" | "superseded";

export type CorruptAnalysisSnapshotFailure = Readonly<{
  code: "CORRUPT_ANALYSIS_SNAPSHOT";
  snapshotId: string;
}>

export type CorruptBaselineSnapshotFailure = Readonly<{
  code: "CORRUPT_BASELINE_SNAPSHOT";
  snapshotId: string;
}>;

export type SnapshotParseFailure = CorruptAnalysisSnapshotFailure | CorruptBaselineSnapshotFailure;

export type ParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; failure: SnapshotParseFailure }>;

export type AnalysisSnapshotEntity = Readonly<{
  id: string;
  localDate: string;
  timezone: string;
  status: AnalysisSnapshotStatus;
  baselineSnapshotId: string;
  result: AnalysisResult;
  generatedAt: Date;
  supersededAt: Date | null;
}>;

export type BaselineSnapshotEntity = Readonly<{
  id: string;
  timezone: string;
  status: AnalysisSnapshotStatus;
  result: BaselineResult;
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
  supersedeCurrentBaseline(at: Date): Promise<void>;
  saveCurrentBaseline(result: BaselineResult): Promise<BaselineSnapshotEntity>;
  findCurrentBaseline(): Promise<ParseResult<BaselineSnapshotEntity> | null>;
  supersedeCurrent(localDate: string, at: Date): Promise<void>;
  saveCurrent(localDate: string, baselineSnapshotId: string, result: AnalysisResult, impactFactors: readonly ImpactFactorEntity[]): Promise<{ snapshotId: string }>;
  findCurrent(localDate: string): Promise<ParseResult<AnalysisSnapshotEntity> | null>;
  findLastSuccessful(localDate: string): Promise<ParseResult<AnalysisSnapshotEntity> | null>;
}

export type AnalysisRepositoryFactory = (
  tx: TransactionClient,
  scope: UserScope,
  options?: Readonly<{ now: () => Date }>,
) => AnalysisRepository;

