import type { UserScope } from "@/shared/domain/contracts";
import type { TransactionClient } from "@/shared/db/transaction";
import type {
  GeneratedAdviceInput,
  PlanDayEntity,
  PlanDayTarget,
  PlannerBaselineSnapshot,
  PlannerGoal,
  ScheduleAdviceEntity,
  SleepPlanEntity,
  SpecialEventInput,
} from "../domain/types";

export type {
  GeneratedAdviceInput,
  PlanDayEntity,
  PlanDayTarget,
  PlannerBaselineSnapshot,
  PlannerGoal,
  ScheduleAdviceEntity,
  SleepPlanEntity,
  SpecialEventInput,
} from "../domain/types";

export interface PlannerRepository {
  createEvent(input: SpecialEventInput): Promise<{ eventId: string }>;
  saveGeneratedAdvice(input: GeneratedAdviceInput): Promise<{ adviceId: string }>;
  findAdvice(adviceId: string): Promise<ScheduleAdviceEntity | null>;
  findAdviceByInputHash?(inputHash: string): Promise<Readonly<Pick<ScheduleAdviceEntity, "id" | "status">> | null>;
  reactivateAdvice?(adviceId: string, planId: string): Promise<void>;
  findCurrentGoal(): Promise<PlannerGoal | null>;
  findCurrentBaseline(): Promise<PlannerBaselineSnapshot | null>;
  findActivePlan(): Promise<SleepPlanEntity | null>;
  listActiveDays(planId: string): Promise<readonly PlanDayEntity[]>;
  listEvents(): Promise<readonly { id: string; type: string; startsAt: string }[]>;
  findLatestGeneratedAdvice(): Promise<ScheduleAdviceEntity | null>;
  findLatestDismissedAdvice(): Promise<ScheduleAdviceEntity | null>;
  findPlanForEvent(eventId: string): Promise<SleepPlanEntity | null>;
  acceptAdvice(input: Readonly<{ adviceId: string; effectiveLocalDate: string }>): Promise<{
    planId: string;
    revisionId: string;
    changedDates: readonly string[];
  }>;
  dismissAdvice(adviceId: string): Promise<void>;
  supersedeGeneratedAdvice(planId: string): Promise<void>;
}

export type CreatePlannerRepository = (db: TransactionClient, scope: UserScope) => PlannerRepository;
