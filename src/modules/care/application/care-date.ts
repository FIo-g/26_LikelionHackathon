import { Temporal } from "@js-temporal/polyfill";
import type { UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import type { CarePlanDay, CarePlanDayQuery, CareRepository } from "./ports";

const queryFor = (scope: UserScope, localDate: string): CarePlanDayQuery => ({
  userId: scope.userId,
  localDate,
  timezone: scope.timezone,
});

const stillBelongsToTonight = (planDay: CarePlanDay, now: Date): boolean => {
  const wakeAt = new Date(planDay.targetWakeAt).getTime();
  return Number.isNaN(wakeAt) || now.getTime() < wakeAt;
};

export const resolveCarePlanDay = async (
  scope: UserScope,
  repository: CareRepository,
  now: Date,
): Promise<Readonly<{ localDate: string; planDay: CarePlanDay | null }>> => {
  const today = wakeLocalDate(now, scope.timezone);
  const todayPlan = await repository.findActivePlanDay(queryFor(scope, today));
  if (todayPlan && stillBelongsToTonight(todayPlan, now)) return { localDate: today, planDay: todayPlan };

  const tomorrow = Temporal.PlainDate.from(today).add({ days: 1 }).toString();
  return { localDate: tomorrow, planDay: await repository.findActivePlanDay(queryFor(scope, tomorrow)) };
};

export const carePlanDayQuery = queryFor;
