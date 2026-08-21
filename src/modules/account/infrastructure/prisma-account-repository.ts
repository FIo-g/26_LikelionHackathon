import { recalculateAnalysis } from "@/modules/analysis/application/recalculate-analysis";
import { createAnalysisRepository } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import { settleNarrationRequests, type NarrationDependencies, type NarrationRequest } from "@/modules/narration/application/generate-narration";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import { createOpenAiNarrationProvider } from "@/modules/narration/infrastructure/openai-narration-provider";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import type { UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import { habitsSchema, profileSchema } from "@/modules/onboarding/domain/schemas";
import type { AccountConnection, AccountRepository, ManualInputCategory } from "../application/ports";

type StoredConnection = Readonly<{ selected: string; state: string }>;

type StoredProfile = Readonly<{
  nickname: string | null;
  timezone: string | null;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
}>;

type StoredHabit = Readonly<{
  caffeine: string;
  exercise: string;
  meal: string;
  alcohol: string | null;
  phoneUsage: string;
}>;

type CreateNarrationRepository = (db: TransactionClient, scope: UserScope) => NarrationRepository;

const hasNarrationModel = (value: TransactionClient): value is TransactionClient & { narration: object } => (
  "narration" in value
);

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

const supersedeAccountDerivedState = async (client: TransactionClient, scope: UserScope, now: Date): Promise<void> => {
  const localDate = wakeLocalDate(now, scope.timezone);
  await client.sleepPlan.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, status: "active" }, data: { status: "superseded", activeKey: null } });
  await client.planDay.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, status: "active", localDate: { gte: localDate } }, data: { status: "superseded", activeKey: null } });
  await client.scheduleAdvice.updateMany({ where: { userId: scope.userId, status: { not: "accepted" } }, data: { status: "superseded" } });
  await client.analysisSnapshot.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, localDate: { gte: localDate }, status: "current" }, data: { status: "superseded", supersededAt: now, currentKey: null } });
};

const refreshAnalysis = async (
  client: TransactionClient,
  scope: UserScope,
  now: Date,
  narrationRepository: NarrationRepository | null,
): Promise<NarrationRequest[]> => {
  const localDate = wakeLocalDate(now, scope.timezone);
  const recalculated = await recalculateAnalysis(
    createAnalysisRepository(client, scope),
    [localDate],
    { now: () => now },
    narrationRepository,
  );
  return recalculated.flatMap((snapshot) => snapshot.pendingNarration ? [snapshot.pendingNarration] : []);
};

export const createPrismaAccountRepository = (
  db: TransactionClient = getPrismaClient(),
  options: Readonly<{
    now?: () => Date;
    narrationDependencies?: NarrationDependencies | null;
    narrationRepositoryFactory?: CreateNarrationRepository;
  }> = {},
): AccountRepository => {
  const client = db;
  const now = options.now ?? (() => new Date());
  const narrationRepositoryFactory = options.narrationRepositoryFactory ?? createPrismaNarrationRepository;

  const resolveNarrationDependencies = (scope: UserScope): NarrationDependencies | null => {
    if (options.narrationDependencies !== undefined) return options.narrationDependencies;
    if (!hasNarrationModel(client)) return null;
    return {
      provider: createOpenAiNarrationProvider(),
      repository: narrationRepositoryFactory(client, scope),
    };
  };

  const dispatchNarrationAfterCommit = async (
    scope: UserScope,
    requests: readonly NarrationRequest[],
  ): Promise<void> => {
    if (requests.length === 0) return;
    await settleNarrationRequests(requests, resolveNarrationDependencies(scope));
  };

  return {
    getViewModelData: async (scope) => {
      const [profile, sleepGoal, habits, connection] = await Promise.all([
        client.userProfile.findUnique({ where: { userId: scope.userId }, select: { nickname: true, timezone: true, age: true, gender: true, heightCm: true, weightKg: true } }) as Promise<StoredProfile | null>,
        client.sleepGoal.findUnique({ where: { userId: scope.userId }, select: { targetBedTime: true, targetWakeTime: true, targetDurationMinutes: true } }),
        client.userHabit.findUnique({ where: { userId: scope.userId }, select: { caffeine: true, exercise: true, meal: true, alcohol: true, phoneUsage: true } }) as Promise<StoredHabit | null>,
        client.connection.findUnique({ where: { userId: scope.userId }, select: { selected: true, state: true } }),
      ]);
      if (!profile?.nickname || !profile.timezone || !sleepGoal) throw new Error("ACCOUNT_SETTINGS_UNAVAILABLE");
      const normalizedProfile = profileSchema.safeParse(profile);
      if (!normalizedProfile.success) throw new Error("ACCOUNT_SETTINGS_UNAVAILABLE");
      const normalizedHabits = habits ? habitsSchema.safeParse(habits) : null;
      if (normalizedHabits && !normalizedHabits.success) throw new Error("ACCOUNT_SETTINGS_UNAVAILABLE");
      return {
        identity: { email: null },
        profile: normalizedProfile.data,
        habits: normalizedHabits?.success ? normalizedHabits.data : null,
        sleepGoal,
        connections: plannedConnections(connection?.selected === "manual" ? connection : null),
        manualInputCategories,
      };
    },
    updateProfile: async (scope, input) => {
      const nextScope = { userId: scope.userId, timezone: input.timezone };
      const pendingNarration = await client.$transaction(async (transaction) => {
        const profile = await transaction.userProfile.findUnique({ where: { userId: scope.userId }, select: { timezone: true } });
        if (!profile) throw new Error("ACCOUNT_PROFILE_NOT_FOUND");
        await transaction.userProfile.updateMany({
          where: { userId: scope.userId },
          data: {
            nickname: input.nickname,
            timezone: input.timezone,
            ...(input.age === undefined ? {} : { age: input.age }),
            ...(input.gender === undefined ? {} : { gender: input.gender }),
            ...(input.heightCm === undefined ? {} : { heightCm: input.heightCm }),
            ...(input.weightKg === undefined ? {} : { weightKg: input.weightKg }),
          },
        });
        if (profile.timezone === input.timezone) return [];
        const at = now();
        await supersedeAccountDerivedState(transaction, scope, at);
        const narrationRepository = hasNarrationModel(transaction)
          ? narrationRepositoryFactory(transaction, nextScope)
          : null;
        return refreshAnalysis(transaction, nextScope, at, narrationRepository);
      });
      await dispatchNarrationAfterCommit(nextScope, pendingNarration);
    },
    updateSleepGoal: async (scope, input) => {
      const pendingNarration = await client.$transaction(async (transaction) => {
        await transaction.sleepGoal.updateMany({ where: { userId: scope.userId }, data: input });
        const at = now();
        const localDate = wakeLocalDate(at, scope.timezone);
        await transaction.scheduleAdvice.updateMany({ where: { userId: scope.userId, status: { not: "accepted" } }, data: { status: "superseded" } });
        await transaction.analysisSnapshot.updateMany({ where: { userId: scope.userId, timezone: scope.timezone, localDate, status: "current" }, data: { status: "superseded", supersededAt: at, currentKey: null } });
        const narrationRepository = hasNarrationModel(transaction)
          ? narrationRepositoryFactory(transaction, scope)
          : null;
        return refreshAnalysis(transaction, scope, at, narrationRepository);
      });
      await dispatchNarrationAfterCommit(scope, pendingNarration);
    },
  };
};
