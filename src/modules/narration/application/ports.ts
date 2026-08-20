import type { VersionedPayload } from "@/shared/domain/contracts";
import type { NarrationOutput, NarrationFacts, NarrationTarget } from "../domain/types";

export interface NarrationProvider {
  generate(input: NarrationFacts, signal: AbortSignal): Promise<NarrationOutput>;
}

export interface NarrationRepository {
  createPending(target: NarrationTarget, inputHash: string, facts: NarrationFacts): Promise<{ narrationId: string; created: boolean }>;
  markReady(narrationId: string, output: VersionedPayload<NarrationOutput>): Promise<void>;
  markFallback(narrationId: string, output: VersionedPayload<NarrationOutput>): Promise<void>;
  recoverStalePending(now: Date): Promise<number>;
  retry(narrationId: string): Promise<Readonly<{ narrationId: string; facts: NarrationFacts }> | null>;
  findForAnalysisSnapshot(analysisSnapshotId: string): Promise<Readonly<{
    id: string;
    status: "pending" | "ready" | "template-fallback";
    retryCount: number;
    output: VersionedPayload<NarrationOutput> | null;
  }> | null>;
}
