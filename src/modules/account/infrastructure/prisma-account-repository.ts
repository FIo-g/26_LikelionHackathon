import { recalculateAnalysis } from "@/modules/analysis/application/recalculate-analysis";
import { createAnalysisRepository } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import type { AccountConnection, AccountData, AccountRepository, ManualInputCategory } from "../application/ports";

type StoredProfile = Readonly<{ nickname: string | null; timezone: string | null }>;
type StoredGoal = Readonly<{ targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }>;
type StoredConnection = Readonly<{ selected: string; state: string }>;

type AccountPrismaClient = TransactionClient & {
  userProfile: { findUnique: (args: unknown) => Promise<StoredProfile | null>; updateMany: (args: unknown) => Promise<unknown> };
  sleepGoal: { findUnique: (args: unknown) => Promise<StoredGoal | null>; updateMany: (args: unknown) => Promise<unknown> };
  userHabit: { findUnique: (args: unknown) => Promise<unknown> };
  connection: { findUnique: (args: unknown) => Promise<StoredConnection | null> };
  sleepPlan: { updateMany: (args: unknown) => Promise<unknown> };
  planDay: { updateMany: (args: unknown) => Promise<unknown> };
  scheduleAdvice: { updateMany: (args: unknown) => Promise<unknown> };
  analysisSnapshot: { updateMany: (args: unknown) => Promise<unknown> };
  $transaction: <T>(callback: (transaction: AccountPrismaClient) => Promise<T>) => Promise<T>;
};

const manualInputCategories: readonly ManualInputCategory[] = [
  { key: "sleep", label: "수면" }, { key: "phone", label: "휴대폰" }, { key: "caffeine", label: "카페인" },
  { key: "alcohol", label: "음주" }, { key: "meal", label: "식사" }, { key: "exercise", label: "운동" }, { key: "wellness", label: "웰니스" },
];

const plannedConnections = (manual: StoredConnection | null): readonly AccountConnection[] => [
  { type: "manual", label: "직접 입력", mode: "manual", availability: "available", state: manual?.state === "complete" ? "complete" : "needs-input", lastSyncedAt: null },
  { type: "wearable", label: "웨어러블", mode: "automatic", availability: "coming-soon", state: "unavailable", lastSyncedAt: null },
  { type: "phone", label: "휴대폰", mode: "automatic", availability: "coming-soon", state: "unavailable", lastSyncedAt: null },
  { type: "calendar", label: "캘린더", mode: "automatic", availability: "coming-soon", state: "unavailable", lastSyncedAt: null },
];

const supersedeAccountDerivedState = async (client: AccountPrismaClient, scope: UserScope, timezone: string, now: Date): Promise<void> => {
  const localDate = wakeLocalDate(now, scope.timezone);
  await client.sleepPlan.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, status: "active" }, data: { status: "superseded", activeKey: null } });
  await client.planDay.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, status: "active", localDate: { gte: localDate } }, data: { status: "superseded", activeKey: null } });
  await client.scheduleAdvice.updateMany({ where: { userId: scope.userId, status: { not: "accepted" } }, data: { status: "superseded" } });
  await client.analysisSnapshot.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, localDate: { gte: localDate }, status: "current" }, data: { status: "superseded", supersededAt: now, currentKey: null } });
};

const refreshAnalysis = async (client: AccountPrismaClient, scope: UserScope, now: Date): Promise<void> => {
  const localDate = wakeLocalDate(now, scope.timezone);
  await recalculateAnalysis(createAnalysisRepository(client, scope), [localDate], { now: () => now });
};

export const createPrismaAccountRepository = (
  db: TransactionClient = getPrismaClient() as TransactionClient,
  options: Readonly<{ now?: () => Date }> = {},
): AccountRepository => {
  const client = db as AccountPrismaClient;
  const now = options.now ?? (() => new Date());
  return {
    getViewModelData: async (scope) => {
      const [profile, sleepGoal, _habits, connection] = await Promise.all([
        client.userProfile.findUnique({ where: { userId: scope.userId }, select: { nickname: true, timezone: true } }),
        client.sleepGoal.findUnique({ where: { userId: scope.userId }, select: { targetBedTime: true, targetWakeTime: true, targetDurationMinutes: true } }),
        client.userHabit.findUnique({ where: { userId: scope.userId } }),
        client.connection.findUnique({ where: { userId: scope.userId }, select: { selected: true, state: true } }),
      ]);
      void _habits;
      if (!profile?.nickname || !profile.timezone || !sleepGoal) throw new Error("ACCOUNT_SETTINGS_UNAVAILABLE");
      return {
        identity: { email: null },
        profile: { nickname: profile.nickname, timezone: profile.timezone },
        sleepGoal,
        connections: plannedConnections(connection?.selected === "manual" ? connection : null),
        manualInputCategories,
      };
    },
    updateProfile: async (scope, input) => {
      await client.$transaction(async (transaction) => {
        const profile = await transaction.userProfile.findUnique({ where: { userId: scope.userId }, select: { timezone: true } });
        if (!profile) throw new Error("ACCOUNT_PROFILE_NOT_FOUND");
        await transaction.userProfile.updateMany({ where: { userId: scope.userId }, data: input });
        if (profile.timezone === input.timezone) return;
        const at = now();
        await supersedeAccountDerivedState(transaction, scope, input.timezone, at);
        await refreshAnalysis(transaction, { userId: scope.userId, timezone: input.timezone }, at);
      });
    },
    updateSleepGoal: async (scope, input) => {
      await client.$transaction(async (transaction) => {
        await transaction.sleepGoal.updateMany({ where: { userId: scope.userId }, data: input });
        const at = now();
        const localDate = wakeLocalDate(at, scope.timezone);
        await transaction.scheduleAdvice.updateMany({ where: { userId: scope.userId, status: { not: "accepted" } }, data: { status: "superseded" } });
        await transaction.analysisSnapshot.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, localDate, status: "current" }, data: { status: "superseded", supersededAt: at, currentKey: null } });
        await refreshAnalysis(transaction, scope, at);
      });
    },
  };
};
