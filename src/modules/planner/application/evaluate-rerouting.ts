import type { Clock, UserScope } from "@/shared/domain/contracts";
import { systemClock } from "@/shared/time/system-clock";
import { hashCanonicalJson } from "@/shared/validation/canonical-json";
import { buildAdviceNarrationFacts } from "@/modules/narration/domain/types";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import type { NarrationRequest } from "@/modules/narration/application/generate-narration";
import type { CreateRecordInput } from "@/modules/records/domain/types";
import {
  generateRerouteProposal,
  rerouteTriggerInstant,
  selectReroutePlanDays,
} from "../domain/generate-reroute-proposal";
import type { PlannerRepository } from "./ports";

export type ReroutingMutation = Readonly<{
  recordId: string;
  input: CreateRecordInput;
}>;

export type ReroutingEvaluation = Readonly<{
  adviceId: string;
  pendingNarration: NarrationRequest | null;
}> | null;

export const evaluateRerouting = async (
  scope: UserScope,
  plannerRepository: PlannerRepository,
  finalRecords: readonly ReroutingMutation[],
  dependencies: Readonly<{ clock?: Clock; narrationRepository?: NarrationRepository | null }> = {},
): Promise<ReroutingEvaluation> => {
  const clock = dependencies.clock ?? systemClock;
  const activePlan = await plannerRepository.findActivePlan();
  if (!activePlan) return null;

  const [goal, baseline, activeDays] = await Promise.all([
    plannerRepository.findCurrentGoal(),
    plannerRepository.findCurrentBaseline(),
    plannerRepository.listActiveDays(activePlan.id),
  ]);
  if (!goal) return null;
  const now = clock.now();

  const proposals = finalRecords
    .slice()
    .sort((left, right) => left.recordId.localeCompare(right.recordId))
    .map((record) => {
      const trigger = { recordId: record.recordId, input: record.input };
      const eligibleDays = selectReroutePlanDays(activeDays, trigger, now);
      return {
        record,
        trigger,
        eligibleDays,
        proposal: generateRerouteProposal({
          timezone: scope.timezone,
          goal,
          baseline,
          trigger,
          activeDays: eligibleDays,
          now,
        }),
      };
    })
    .filter((candidate): candidate is typeof candidate & {
      proposal: NonNullable<typeof candidate.proposal>;
    } => candidate.proposal !== null);
  const selected = proposals[0];
  if (!selected) {
    await plannerRepository.supersedeGeneratedAdvice(activePlan.id);
    return null;
  }
  const rerouteRecords = proposals.map(({ record }) => ({
    id: record.recordId,
    type: record.input.type,
    input: Object.fromEntries(Object.entries(record.input).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ])),
  }));

  const inputSnapshot = {
    schemaVersion: 1 as const,
    timezone: scope.timezone,
    goal,
    baselineId: baseline?.id ?? null,
    event: null,
    planId: activePlan.id,
    triggerRecordId: selected.record.recordId,
    planActiveKey: activePlan.activeKey ?? null,
    planRevisionId: activePlan.revisionId ?? null,
    triggerInstant: rerouteTriggerInstant(selected.trigger).toISOString(),
    activeDays: selected.eligibleDays.map((day) => ({
      localDate: day.localDate,
      targetBedAt: day.targetBedAt,
      targetWakeAt: day.targetWakeAt,
      caffeineCutoffAt: day.caffeineCutoffAt,
      exerciseCutoffAt: day.exerciseCutoffAt,
      mealCutoffAt: day.mealCutoffAt,
      windDownAt: day.windDownAt,
    })),
    rerouteRecords,
  };
  const inputHash = hashCanonicalJson(inputSnapshot);
  const matchingAdvice = await plannerRepository.findAdviceByInputHash?.(inputHash);
  if (matchingAdvice?.status === "generated") return { adviceId: matchingAdvice.id, pendingNarration: null };
  if (matchingAdvice?.status === "superseded" && plannerRepository.reactivateAdvice) {
    await plannerRepository.supersedeGeneratedAdvice(activePlan.id);
    await plannerRepository.reactivateAdvice(matchingAdvice.id, activePlan.id);
    return { adviceId: matchingAdvice.id, pendingNarration: null };
  }
  if (matchingAdvice) return null;

  await plannerRepository.supersedeGeneratedAdvice(activePlan.id);
  const saveInput = {
    eventId: null,
    planId: activePlan.id,
    triggerType: "reroute",
    inputHash,
    inputSnapshot,
    proposal: selected.proposal,
  } as const;
  try {
    const saved = await plannerRepository.saveGeneratedAdvice(saveInput);
    const facts = buildAdviceNarrationFacts(saved.adviceId, selected.proposal, null);
    const pendingNarration = dependencies.narrationRepository
      ? await dependencies.narrationRepository.createPending(
        { analysisSnapshotId: null, scheduleAdviceId: saved.adviceId },
        hashCanonicalJson(facts),
        facts,
      ).then(({ narrationId, created }) => created ? ({ narrationId, facts }) : null)
      : null;
    return { adviceId: saved.adviceId, pendingNarration };
  } catch (error) {
    if (!(typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002")) throw error;
    const concurrentAdvice = await plannerRepository.findAdviceByInputHash?.(inputHash);
    if (concurrentAdvice?.status === "generated") return { adviceId: concurrentAdvice.id, pendingNarration: null };
    return null;
  }
};
