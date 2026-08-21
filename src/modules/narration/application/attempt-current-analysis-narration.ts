import type { AnalysisRepository } from "@/modules/analysis/application/ports";
import { buildAnalysisNarrationFacts } from "@/modules/narration/domain/types";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import {
  generateNarration,
  type NarrationDependencies,
} from "./generate-narration";

export type InitialAnalysisNarrationOutcome =
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "template-fallback"; narrationId: string }>
  | Readonly<{ status: "unavailable"; narrationId: string }>
  | Readonly<{ status: "not-available" }>
  | Readonly<{ status: "already-exists" }>;

type Dependencies = Readonly<{
  clock: Clock;
  analysisRepository: AnalysisRepository;
  narrationDependencies: NarrationDependencies;
}>;

/**
 * Creates narration only for the caller's current scoped analysis snapshot.
 * The snapshot and narration facts never come from the client.
 */
export const attemptCurrentAnalysisNarration = async (
  scope: UserScope,
  dependencies: Dependencies,
): Promise<InitialAnalysisNarrationOutcome> => {
  const localDate = wakeLocalDate(dependencies.clock.now(), scope.timezone);
  const current = await dependencies.analysisRepository.findCurrent(localDate);
  if (!current?.ok) return { status: "not-available" };

  const facts = buildAnalysisNarrationFacts(current.value.id, current.value.result);
  const created = await dependencies.narrationDependencies.repository.createPending(
    { analysisSnapshotId: current.value.id, scheduleAdviceId: null },
    hashCanonicalJson(facts),
    facts,
  );
  if (!created.created) return { status: "already-exists" };

  const generated = await generateNarration(
    { narrationId: created.narrationId, facts },
    dependencies.narrationDependencies,
  );
  if (!dependencies.narrationDependencies.provider) {
    return { status: "unavailable", narrationId: created.narrationId };
  }
  return generated === "ready"
    ? { status: "ready" }
    : { status: "template-fallback", narrationId: created.narrationId };
};
