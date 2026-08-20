import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";

type MockConnection = {
  userId: string;
  selected: string;
  mode: string;
  availability: string;
  state: string;
  lastSyncedAt: null;
};

type MockSleepGoal = {
  userId: string;
  targetBedTime: string;
  targetWakeTime: string;
  targetDurationMinutes: number;
};

type MockHabits = {
  userId: string;
  caffeine: string;
  exercise: string;
  meal: string;
  phoneUsage: string;
};

type MockProfile = {
  userId: string;
  nickname: string;
  timezone: string;
  onboardingCompletedAt: Date | null;
};

type MockDb = {
  connection: MockConnection | null;
  sleepGoal: MockSleepGoal | null;
  userHabit: MockHabits | null;
  userProfile: MockProfile | null;
};

const createPrisma = (store: MockDb) => ({
  connection: {
    upsert: async ({ create, update }: { create: MockConnection; update: Partial<MockConnection> }) => {
      store.connection = {
        ...store.connection,
        ...create,
        ...update,
        userId: create.userId,
      } as MockConnection;
      return store.connection;
    },
    findUnique: async () => store.connection,
  },
  sleepGoal: {
    upsert: async ({ create, update }: { create: MockSleepGoal; update: Partial<MockSleepGoal> }) => {
      store.sleepGoal = {
        ...store.sleepGoal,
        ...create,
        ...update,
        userId: create.userId,
      } as MockSleepGoal;
      return store.sleepGoal;
    },
    findUnique: async () => store.sleepGoal,
  },
  userHabit: {
    upsert: async ({ create, update }: { create: MockHabits; update: Partial<MockHabits> }) => {
      store.userHabit = {
        ...store.userHabit,
        ...create,
        ...update,
        userId: create.userId,
      } as MockHabits;
      return store.userHabit;
    },
    findUnique: async () => store.userHabit,
  },
  userProfile: {
    upsert: async ({ create, update }: { create: MockProfile; update: Partial<MockProfile> }) => {
      if (!store.userProfile) {
        store.userProfile = create;
      } else {
        store.userProfile = {
          ...store.userProfile,
          ...update,
        };
      }

      return store.userProfile;
    },
    findUnique: async () => ({
      nickname: store.userProfile?.nickname ?? null,
      timezone: store.userProfile?.timezone ?? null,
      onboardingCompletedAt: store.userProfile?.onboardingCompletedAt ?? null,
    }),
  },
  $transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
    return callback(createPrisma(store));
  },
});

const database: MockDb = {
  connection: null,
  sleepGoal: null,
  userHabit: null,
  userProfile: null,
};

vi.mock("@/shared/db/prisma", () => ({
  getPrismaClient: () => createPrisma(database),
}));

describe("prisma onboarding repository persistence", () => {
  const userId = "user-1";

  beforeEach(() => {
    database.connection = null;
    database.sleepGoal = null;
    database.userHabit = null;
    database.userProfile = null;
  });

  it("stores each onboarding step and returns resumable progress", async () => {
    const repository = createOnboardingRepository(userId);

    await repository.saveConnect({ selected: "manual" });
    await repository.saveSleepGoal({
      targetBedTime: "23:00",
      targetWakeTime: "07:00",
      targetDurationMinutes: 480,
    });
    await repository.replaceHabits({
      caffeine: "none",
      exercise: "rare",
      meal: "mixed",
      phoneUsage: "low",
    });

    const progress = await repository.getProgress();

    expect(progress.connect).toEqual({ selected: "manual" });
    expect(progress.sleepGoal?.targetDurationMinutes).toBe(480);
    expect(progress.habits).toEqual({
      caffeine: "none",
      exercise: "rare",
      meal: "mixed",
      phoneUsage: "low",
    });
  });

  it("requires complete steps before final completion", async () => {
    const repository = createOnboardingRepository(userId);

    await expect(repository.complete({
      nickname: "tester",
      timezone: "Asia/Seoul",
    })).rejects.toThrow("INCOMPLETE_ONBOARDING");

    await repository.saveConnect({ selected: "manual" });
    await repository.saveSleepGoal({
      targetBedTime: "23:00",
      targetWakeTime: "07:00",
      targetDurationMinutes: 480,
    });
    await repository.replaceHabits({
      caffeine: "none",
      exercise: "rare",
      meal: "mixed",
      phoneUsage: "low",
    });

    await expect(
      repository.complete({
        nickname: "tester",
        timezone: "Asia/Seoul",
      }),
    ).resolves.toBeUndefined();

    expect(database.userProfile?.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(database.userProfile?.nickname).toBe("tester");
    expect(database.userProfile?.timezone).toBe("Asia/Seoul");
  });
});

