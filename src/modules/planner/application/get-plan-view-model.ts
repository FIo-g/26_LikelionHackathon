import { generateGoalPlanTargets } from "../domain/generate-schedule-proposal";
import { diffScheduleProposal, type ScheduleDiff } from "../domain/diff-schedule-proposal";
import type { PlanDayTarget, ScheduleProposal } from "../domain/types";
import type { PlannerRepository } from "./ports";

export type ScheduleAdviceViewModel = Readonly<{
  id: string;
  triggerType: "event" | "reroute";
  status: "generated" | "accepted" | "dismissed" | "superseded" | "failed";
  headline: string;
  proposal: ScheduleProposal;
  diff: readonly ScheduleDiff[];
}>;

export type PlanViewModel = Readonly<{
  calendarConnection: { availability: "coming-soon" };
  planStatus: "active" | "none";
  dismissedAdvice: boolean;
  events: readonly { id: string; type: string; startsAt: string }[];
  advice: ScheduleAdviceViewModel | null;
  days: readonly PlanDayTarget[];
}>;

const adviceHeadline = (type: string | undefined): string => (
  type ? `${type} 일정에 맞춰 수면 시간을 조정해요` : "주요 일정에 맞춰 수면 시간을 조정해요"
);

export const getPlanViewModel = async (
  plannerRepository: PlannerRepository,
  now: Date,
  timezone: string,
): Promise<PlanViewModel> => {
  const [events, generatedAdvice, dismissedAdvice, activePlan, goal] = await Promise.all([
    plannerRepository.listEvents(),
    plannerRepository.findLatestGeneratedAdvice(),
    plannerRepository.findLatestDismissedAdvice(),
    plannerRepository.findActivePlan(),
    plannerRepository.findCurrentGoal(),
  ]);
  const activeDays = activePlan
    ? await plannerRepository.listActiveDays(activePlan.id)
    : [];
  const days = activePlan
    ? activeDays
    : goal
      ? generateGoalPlanTargets(goal, timezone, now)
      : [];
  const eventType = generatedAdvice?.inputSnapshot.event?.type;

  return {
    calendarConnection: { availability: "coming-soon" },
    planStatus: activePlan ? "active" : "none",
    dismissedAdvice: generatedAdvice === null && dismissedAdvice !== null,
    events,
    advice: generatedAdvice ? {
      id: generatedAdvice.id,
      triggerType: generatedAdvice.triggerType,
      status: generatedAdvice.status,
      headline: adviceHeadline(eventType),
      proposal: generatedAdvice.proposal,
      diff: diffScheduleProposal(
        activeDays,
        generatedAdvice.proposal.days.filter((day) => day.localDate >= now.toLocaleDateString("en-CA", { timeZone: timezone })),
      ),
    } : null,
    days,
  };
};
