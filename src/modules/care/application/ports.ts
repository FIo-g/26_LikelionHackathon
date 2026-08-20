import type { PlanDayTarget, PlannerGoal } from "@/modules/planner/domain/types";
import type { CareToolKey } from "../domain/tool-catalog";
import type { RoutineStepKey } from "../domain/routine";

export type CarePlanDay = PlanDayTarget & Readonly<{ id: string }>;
export type CarePlanDayQuery = Readonly<{ userId: string; localDate: string; timezone: string }>;
export type CareRerouteAdvice = Readonly<{ id: string }>;
export type CarePhoneUsage = Readonly<{ localDate: string; durationMinutes: number }>;

export const planDayRoutineRevisionKey = (planDayId: string): string => `plan-day:${planDayId}`;
export const goalRoutineRevisionKey = (goal: PlannerGoal): string => `goal:${goal.targetBedTime}:${goal.targetWakeTime}:${goal.targetDurationMinutes}`;

export interface CareRepository {
  findActivePlanDay(query: CarePlanDayQuery): Promise<CarePlanDay | null>;
  findGoal(): Promise<PlannerGoal | null>;
  /** Optional while non-Prisma test doubles only exercise routine mutations. */
  findGeneratedRerouteAdvice?(): Promise<CareRerouteAdvice | null>;
  /** Returns direct phone-use records only; presentation decides whether there is enough history. */
  listRecentPhoneUsage?(limit: number): Promise<readonly CarePhoneUsage[]>;
  listCompletions(localDate: string, routineRevisionKey: string): Promise<ReadonlySet<string>>;
  completeStep(localDate: string, routineRevisionKey: string, planDayId: string | null, stepKey: RoutineStepKey, completedAt: Date): Promise<void>;
  undoStep(localDate: string, routineRevisionKey: string, planDayId: string | null, stepKey: RoutineStepKey): Promise<void>;
  startTool(input: Readonly<{ localDate: string; toolKey: CareToolKey; plannedDurationSeconds: number; startedAt: Date }>): Promise<{ sessionId: string }>;
  completeTool(sessionId: string, completedAt: Date): Promise<void>;
}
