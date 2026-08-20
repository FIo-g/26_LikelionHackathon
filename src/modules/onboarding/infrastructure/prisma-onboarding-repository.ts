import { getPrismaClient } from "@/shared/db/prisma";
import type {
  ConnectInput,
  HabitValues,
  OnboardingProgressData,
  ProfileDetails,
  ProfileInput,
  SleepGoalInput,
} from "../domain/types";
import type { OnboardingRepository } from "../application/ports";

type OnboardingStore = {
  connection: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
  sleepGoal: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
  userHabit: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
  userProfile: {
    upsert: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

type PrismaClientForOnboarding = OnboardingStore & {
  $transaction: <T>(callback: (tx: OnboardingStore) => Promise<T>) => Promise<T>;
};

type StoredConnection = {
  userId: string;
  selected: string;
  mode: string;
  availability: string;
  state: string;
  lastSyncedAt: Date | null;
};

type StoredSleepGoal = {
  userId: string;
  targetBedTime: string;
  targetWakeTime: string;
  targetDurationMinutes: number;
};

type StoredHabit = {
  caffeine: string;
  exercise: string;
  meal: string;
  alcohol: string | null;
  phoneUsage: string;
};

type StoredProfile = {
  nickname: string | null;
  timezone: string | null;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

const toProgress = async (
  client: OnboardingStore,
  userId: string,
): Promise<OnboardingProgressData> => {
  const [connection, sleepGoal, habits, profile] = await Promise.all([
    client.connection.findUnique({
      where: { userId },
      select: {
        selected: true,
      },
    }) as Promise<StoredConnection | null>,
    client.sleepGoal.findUnique({
      where: { userId },
      select: {
        targetBedTime: true,
        targetWakeTime: true,
        targetDurationMinutes: true,
      },
    }) as Promise<StoredSleepGoal | null>,
    client.userHabit.findUnique({
      where: { userId },
      select: {
        caffeine: true,
        exercise: true,
        meal: true,
        alcohol: true,
        phoneUsage: true,
      },
    }) as Promise<StoredHabit | null>,
    client.userProfile.findUnique({
      where: { userId },
      select: {
        nickname: true,
        timezone: true,
        age: true,
        gender: true,
        heightCm: true,
        weightKg: true,
      },
    }) as Promise<StoredProfile | null>,
  ]);

  return {
    connect: connection?.selected === "manual" ? { selected: "manual" } : null,
    sleepGoal: sleepGoal
      ? {
        targetBedTime: sleepGoal.targetBedTime,
        targetWakeTime: sleepGoal.targetWakeTime,
        targetDurationMinutes: sleepGoal.targetDurationMinutes,
      }
      : null,
    habits: habits
      ? {
        caffeine: habits.caffeine as HabitValues["caffeine"],
        exercise: habits.exercise as HabitValues["exercise"],
        meal: habits.meal as HabitValues["meal"],
        alcohol: habits.alcohol as HabitValues["alcohol"],
        phoneUsage: habits.phoneUsage as HabitValues["phoneUsage"],
      }
      : null,
    profile: profile?.nickname && profile.timezone
      ? {
        nickname: profile.nickname,
        timezone: profile.timezone,
        age: profile.age,
        gender: profile.gender as ProfileDetails["gender"],
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
      }
      : null,
  };
};

export const createOnboardingRepository = (
  userId: string,
  client: PrismaClientForOnboarding = getPrismaClient() as PrismaClientForOnboarding,
): OnboardingRepository => {
  const prisma = client;

  const verifyComplete = (progress: OnboardingProgressData): void => {
    if (!progress.profile || !progress.connect || !progress.sleepGoal || !progress.habits) {
      throw new Error("INCOMPLETE_ONBOARDING");
    }
  };

  return {
    saveProfile: async (input: ProfileInput) => {
      const profile = {
        nickname: input.nickname,
        timezone: input.timezone,
        age: input.age ?? null,
        gender: input.gender ?? null,
        heightCm: input.heightCm ?? null,
        weightKg: input.weightKg ?? null,
      };
      await prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...profile },
        update: profile,
      });
    },
    saveConnect: async (input: ConnectInput) => {
      await prisma.connection.upsert({
        where: { userId },
        create: {
          userId,
          selected: input.selected,
          mode: "manual",
          availability: "available",
          state: "needs-input",
          lastSyncedAt: null,
        },
        update: {
          selected: input.selected,
          mode: "manual",
          availability: "available",
          state: "needs-input",
          lastSyncedAt: null,
        },
      });
    },
    saveSleepGoal: async (input: SleepGoalInput) => {
      await prisma.sleepGoal.upsert({
        where: { userId },
        create: {
          userId,
          targetBedTime: input.targetBedTime,
          targetWakeTime: input.targetWakeTime,
          targetDurationMinutes: input.targetDurationMinutes,
        },
        update: {
          targetBedTime: input.targetBedTime,
          targetWakeTime: input.targetWakeTime,
          targetDurationMinutes: input.targetDurationMinutes,
        },
      });
    },
    replaceHabits: async (input: HabitValues) => {
      await prisma.userHabit.upsert({
        where: { userId },
        create: {
          userId,
          caffeine: input.caffeine,
          exercise: input.exercise,
          meal: input.meal,
          alcohol: input.alcohol ?? null,
          phoneUsage: input.phoneUsage,
        },
        update: {
          caffeine: input.caffeine,
          exercise: input.exercise,
          meal: input.meal,
          alcohol: input.alcohol ?? null,
          phoneUsage: input.phoneUsage,
        },
      });
    },
    complete: async () => {
      await prisma.$transaction(async (tx) => {
        const progress = await toProgress(tx, userId);

        verifyComplete(progress);

        const result = await tx.userProfile.updateMany({
          where: { userId },
          data: { onboardingCompletedAt: new Date() },
        });
        if (result.count !== 1) throw new Error("INCOMPLETE_ONBOARDING");
      });
    },
    getProgress: async () => {
      return toProgress(prisma, userId);
    },
  };
};
