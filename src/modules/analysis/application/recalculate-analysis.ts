import { calculateAnalysis } from "@/modules/analysis/domain/provisional-v1";
import { calculateBaseline } from "@/modules/analysis/domain/calculate-baseline";
import { createAnalysisImpactRows } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import type { Clock } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import { buildAnalysisNarrationFacts } from "@/modules/narration/domain/types";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import type { NarrationRequest } from "@/modules/narration/application/generate-narration";
import { Temporal } from "@js-temporal/polyfill";
import type { AnalysisRepository } from "./ports";

const assertLocalDate = (localDate: string): void => {
  try {
    if (Temporal.PlainDate.from(localDate).toString() === localDate) {
      return;
    }
  } catch {
    // Fall through to the stable application error below.
  }
  throw new Error("INVALID_LOCAL_DATE");
};

const normalizeDates = (dates: readonly string[]): string[] => {
  const next = new Set<string>();
  for (const localDate of dates) {
    assertLocalDate(localDate);
    next.add(localDate);
  }

  return [...next].sort();
};

export type RecalculatedSnapshot = Readonly<{
  localDate: string;
  snapshotId: string;
  pendingNarration: NarrationRequest | null;
}>;

export const recalculateAnalysis = async (
  analysisRepository: AnalysisRepository,
  affectedLocalDates: readonly string[],
  clock: Clock,
  narrationRepository: NarrationRepository | null = null,
): Promise<ReadonlyArray<RecalculatedSnapshot>> => {
  const now = clock.now();

  const uniqueDates = normalizeDates(affectedLocalDates);
  const snapshots: RecalculatedSnapshot[] = [];

  for (const localDate of uniqueDates) {
    const input = await analysisRepository.loadWindow(localDate, 14);
    const baseline = calculateBaseline(input);
    await analysisRepository.supersedeCurrentBaseline(now);
    const baselineEntity = await analysisRepository.saveCurrentBaseline(baseline);
    if (!baselineEntity.id) {
      throw new Error("INVALID_BASELINE_SNAPSHOT_ID");
    }
    const result = calculateAnalysis(input);
    const impactFactors = createAnalysisImpactRows(input);

    await analysisRepository.supersedeCurrent(localDate, now);
    const snapshot = await analysisRepository.saveCurrent(
      localDate,
      baselineEntity.id,
      result,
      impactFactors,
    );
    const facts = buildAnalysisNarrationFacts(snapshot.snapshotId, result);
    const isCurrentSnapshot = localDate === wakeLocalDate(clock.now(), input.timezone);
    const pendingNarration = narrationRepository && isCurrentSnapshot
      ? await narrationRepository.createPending(
        { analysisSnapshotId: snapshot.snapshotId, scheduleAdviceId: null },
        hashCanonicalJson(facts),
        facts,
      ).then(({ narrationId, created }) => created ? ({ narrationId, facts }) : null)
      : null;

    snapshots.push({
      localDate,
      snapshotId: snapshot.snapshotId,
      pendingNarration,
    });
  }

  return snapshots;
};
