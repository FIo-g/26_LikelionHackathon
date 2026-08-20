import { PROVISIONAL_SCHEDULE_RULES } from "@/shared/domain/provisional-schedule-rules";

export const PROVISIONAL_PLANNER_RULES = Object.freeze({
  ...PROVISIONAL_SCHEDULE_RULES,
  maximumDailyMovementMinutes: 15,
  maximumAdjustmentDays: 14,
});
