import type { PlanDayTarget, PlannerGoal } from "@/modules/planner/domain/types";
import type { TransactionClient } from "@/shared/db/transaction";
import type { UserScope } from "@/shared/domain/contracts";
import type { CareToolKey } from "../domain/tool-catalog";
import type { RoutineStepKey } from "../domain/routine";
import type { CarePlanDay, CareRepository } from "../application/ports";

type CareClient = {
  planDay: { findFirst: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null> };
  sleepGoal: { findUnique: (args: { where: { userId: string } }) => Promise<Record<string, unknown> | null> };
  routineCompletion: {
    findMany: (args: { where: Record<string, unknown>; select: { stepKey: true } }) => Promise<readonly { stepKey: string }[]>;
    upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  };
  careToolSession: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

const toDateString = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);

const mapPlanDay = (row: Record<string, unknown>): CarePlanDay => ({
  id: String(row.id),
  localDate: String(row.localDate),
  targetBedAt: toDateString(row.targetBedAt),
  targetWakeAt: toDateString(row.targetWakeAt),
  caffeineCutoffAt: toDateString(row.caffeineCutoffAt),
  exerciseCutoffAt: toDateString(row.exerciseCutoffAt),
  mealCutoffAt: toDateString(row.mealCutoffAt),
  windDownAt: toDateString(row.windDownAt),
});

export const createPrismaCareRepository = (db: TransactionClient, scope: UserScope): CareRepository => {
  const client = db as TransactionClient & CareClient;
  return {
    findActivePlanDay: async (localDate) => {
      const row = await client.planDay.findFirst({ where: { userId: scope.userId, localDate, status: "active" } });
      return row ? mapPlanDay(row) : null;
    },
    findGoal: async () => {
      const goal = await client.sleepGoal.findUnique({ where: { userId: scope.userId } });
      return goal ? { targetBedTime: String(goal.targetBedTime), targetWakeTime: String(goal.targetWakeTime), targetDurationMinutes: Number(goal.targetDurationMinutes) } satisfies PlannerGoal : null;
    },
    listCompletions: async (localDate, routineRevisionKey) => new Set((await client.routineCompletion.findMany({ where: { userId: scope.userId, localDate, routineRevisionKey }, select: { stepKey: true } })).map((row) => row.stepKey)),
    completeStep: async (localDate, routineRevisionKey, planDayId, stepKey, completedAt) => {
      await client.routineCompletion.upsert({
        where: { userId_localDate_routineRevisionKey_stepKey: { userId: scope.userId, localDate, routineRevisionKey, stepKey } },
        create: { userId: scope.userId, localDate, routineRevisionKey, planDayId, stepKey, completedAt },
        update: {},
      });
    },
    undoStep: async (localDate, routineRevisionKey, planDayId, stepKey) => { await client.routineCompletion.deleteMany({ where: { userId: scope.userId, localDate, routineRevisionKey, planDayId, stepKey } }); },
    startTool: async (input) => {
      const session = await client.careToolSession.create({ data: { userId: scope.userId, ...input, completedAt: null } });
      return { sessionId: session.id };
    },
    completeTool: async (sessionId, completedAt) => { await client.careToolSession.updateMany({ where: { id: sessionId, userId: scope.userId, completedAt: null }, data: { completedAt } }); },
  };
};
