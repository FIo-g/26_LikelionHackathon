import type { Evidence, VersionedPayload } from "@/shared/domain/contracts";

export type PlannerConfidence = "low" | "medium" | "high";
export type PlannerStatus = "generated" | "accepted" | "dismissed" | "superseded" | "failed";
export type PlanStatus = "draft" | "active" | "completed" | "superseded";

export type PlanDayTarget = Readonly<{
  localDate: string;
  targetBedAt: string;
  targetWakeAt: string;
  caffeineCutoffAt: string;
  exerciseCutoffAt: string;
  mealCutoffAt: string;
  windDownAt: string;
}>;

export type ScheduleProposal = Readonly<{
  adjustmentStartsOn: string;
  eventWakeAt: string;
  days: readonly PlanDayTarget[];
  conflicts: readonly string[];
  confidence: PlannerConfidence;
  evidence: readonly Evidence[];
  algorithmVersion: "provisional-v1";
}>;

export type SpecialEventInput = Readonly<{
  title: string;
  type: string;
  startsAt: string;
  desiredWakeAt: string | null;
  notes: string | null;
  timezone: string;
}>;

export type SpecialEventSummary = Readonly<{
  id: string;
  title: string;
  type: string;
  startsAt: string;
}>;

export type PlannerInputSnapshot = VersionedPayload<{
  timezone: string;
  goal: {
    targetBedTime: string;
    targetWakeTime: string;
    targetDurationMinutes: number;
  };
  baselineId: string | null;
  event: {
    id: string;
    type: string;
    startsAt: string;
    desiredWakeAt: string | null;
  } | null;
  planId: string | null;
  triggerRecordId: string | null;
  planActiveKey?: string | null;
  planRevisionId?: string | null;
  triggerInstant?: string;
  activeDays?: readonly PlanDayTarget[];
  rerouteRecords?: readonly Readonly<{ id: string; type: string; input: Record<string, string | number | null> }>[];
}>;

export type GeneratedAdviceInput = Readonly<{
  eventId: string | null;
  planId: string | null;
  triggerType: "event" | "reroute";
  inputHash: string;
  inputSnapshot: PlannerInputSnapshot;
  proposal: ScheduleProposal;
}>;

export type ScheduleAdviceEntity = GeneratedAdviceInput & Readonly<{
  id: string;
  status: PlannerStatus;
}>;

export type SleepPlanEntity = Readonly<{
  id: string;
  status: PlanStatus;
  activeKey?: string | null;
  revisionId?: string | null;
}>;

export type PlanDayEntity = PlanDayTarget & Readonly<{
  id: string;
  planId: string;
  status: PlanStatus;
}>;

export type AcceptedAdviceInput = Readonly<{
  adviceId: string;
  before: VersionedPayload<{ days: readonly PlanDayTarget[] }>;
  after: VersionedPayload<{ days: readonly PlanDayTarget[] }>;
}>;

export type PlannerGoal = Readonly<{
  targetBedTime: string;
  targetWakeTime: string;
  targetDurationMinutes: number;
}>;

export type PlannerBaselineSnapshot = Readonly<{
  id: string;
  status: string;
  result: unknown;
}>;

export type ScheduleContext = Readonly<{
  timezone: string;
  goal: PlannerGoal;
  baseline: PlannerBaselineSnapshot | null;
  event: Readonly<{
    id: string;
    type: string;
    startsAt: string;
    desiredWakeAt: string | null;
  }>;
}>;
