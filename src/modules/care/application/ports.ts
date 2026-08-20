import type { PlanDayTarget, PlannerGoal } from "@/modules/planner/domain/types";
import type { CareToolKey } from "../domain/tool-catalog";
import type { RoutineStepKey } from "../domain/routine";

export type CarePlanDay = PlanDayTarget & Readonly<{ id: string }>;
export type CarePlanDayQuery = Readonly<{ userId: string; localDate: string; timezone: string }>;

export const planDayRoutineRevisionKey = (planDayId: string): string => `plan-day:${planDayId}`;
export const goalRoutineRevisionKey = (goal: PlannerGoal): string => `goal:${goal.targetBedTime}:${goal.targetWakeTime}:${goal.targetDurationMinutes}`;

export interface CareRepository {
  findActivePlanDay(query: CarePlanDayQuery): Promise<CarePlanDay | null>;
  findGoal(): Promise<PlannerGoal | null>;
  listCompletions(localDate: string, routineRevisionKey: string): Promise<ReadonlySet<string>>;
  completeStep(localDate: string, routineRevisionKey: string, planDayId: string | null, stepKey: RoutineStepKey, completedAt: Date): Promise<void>;
  undoStep(localDate: string, routineRevisionKey: string, planDayId: string | null, stepKey: RoutineStepKey): Promise<void>;
  startTool(input: Readonly<{ localDate: string; toolKey: CareToolKey; plannedDurationSeconds: number; startedAt: Date }>): Promise<{ sessionId: string }>;
  completeTool(sessionId: string, completedAt: Date): Promise<void>;
}
