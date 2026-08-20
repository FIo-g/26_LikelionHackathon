import { getPrismaClient } from "@/shared/db/prisma";
import type { OnboardingProgressData, SleepGoalInput, HabitValues, ProfileInput, ConnectInput } from "../domain/types";
import type { OnboardingRepository } from "../application/ports";

type PrismaClientForOnboarding = ReturnType<typeof getPrismaClient> & {
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
    findUnique: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: PrismaClientForOnboarding) => Promise<T>) => Promise<T>;
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
  userId: string;
  caffeine: string;
  exercise: string;
  meal: string;
  phoneUsage: string;
};

type StoredProfile = {
  userId: string;
  nickname: string | null;
  timezone: string | null;
  onboardingCompletedAt: Date | null;
};

const toProgress = async (
  client: PrismaClientForOnboarding,
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
        phoneUsage: true,
      },
    }) as Promise<StoredHabit | null>,
    client.userProfile.findUnique({
      where: { userId },
      select: {
        nickname: true,
        timezone: true,
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
        phoneUsage: habits.phoneUsage as HabitValues["phoneUsage"],
      }
      : null,
    profile: profile?.nickname && profile.timezone
      ? {
        nickname: profile.nickname,
        timezone: profile.timezone,
      }
      : null,
  };
};

export const createOnboardingRepository = (userId: string): OnboardingRepository => {
  const prisma = getPrismaClient() as PrismaClientForOnboarding;

  const verifyComplete = (progress: OnboardingProgressData): void => {
    if (!progress.connect || !progress.sleepGoal || !progress.habits) {
      throw new Error("INCOMPLETE_ONBOARDING");
    }
  };

  return {
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
          phoneUsage: input.phoneUsage,
        },
        update: {
          caffeine: input.caffeine,
          exercise: input.exercise,
          meal: input.meal,
          phoneUsage: input.phoneUsage,
        },
      });
    },
    complete: async (input: ProfileInput) => {
      await prisma.$transaction(async (tx) => {
        const progress = await toProgress(tx, userId);

        verifyComplete(progress);

        const now = new Date();

        await tx.userProfile.upsert({
          where: { userId },
          create: {
            userId,
            nickname: input.nickname,
            timezone: input.timezone,
            onboardingCompletedAt: now,
          },
          update: {
            nickname: input.nickname,
            timezone: input.timezone,
            onboardingCompletedAt: now,
          },
        });
      });
    },
    getProgress: async () => {
      return toProgress(prisma, userId);
    },
  };
};
