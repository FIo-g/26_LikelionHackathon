import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { createTestPrismaClient } from "../support/prisma-client";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isDedicatedOnboardingDatabase = databaseUrl.startsWith("file:")
  && /(?:contract|onboarding|test)/i.test(databaseUrl)
  && !/(?:prod(?:uction)?|dev(?:elopment)?|shared|staging|main|default)/i.test(databaseUrl);
const describeSqlite = isDedicatedOnboardingDatabase ? describe : describe.skip;
const prisma = createTestPrismaClient(databaseUrl || "file:./prisma/unused-onboarding.sqlite");
const userId = "onboarding-concurrency-user";

type Repository = ReturnType<typeof createOnboardingRepository>;
type RepositoryFactory = (ownedUserId: string, client: typeof prisma) => Repository;
const repositoryFor = createOnboardingRepository as RepositoryFactory;

const seedUser = async (): Promise<void> => {
  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@example.invalid`,
    },
  });
};

const cleanUser = async (): Promise<void> => {
  await prisma.connection.deleteMany({ where: { userId } });
  await prisma.userHabit.deleteMany({ where: { userId } });
  await prisma.sleepGoal.deleteMany({ where: { userId } });
  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
};

describeSqlite("prisma onboarding repository persistence", () => {
  beforeEach(async () => {
    await cleanUser();
    await seedUser();
  });

  afterAll(async () => {
    await cleanUser();
    await prisma.$disconnect();
  });

  it("stores each onboarding step and returns resumable progress", async () => {
    const repository = repositoryFor(userId, prisma);

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

    await expect(repository.getProgress()).resolves.toEqual({
      connect: { selected: "manual" },
      sleepGoal: {
        targetBedTime: "23:00",
        targetWakeTime: "07:00",
        targetDurationMinutes: 480,
      },
      habits: {
        caffeine: "none",
        exercise: "rare",
        meal: "mixed",
        phoneUsage: "low",
      },
      profile: null,
    });
  });

  it("requires complete steps before final completion", async () => {
    const repository = repositoryFor(userId, prisma);

    await expect(repository.complete({ nickname: "tester", timezone: "Asia/Seoul" }))
      .rejects.toThrow("INCOMPLETE_ONBOARDING");

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

    await expect(repository.complete({ nickname: "tester", timezone: "Asia/Seoul" }))
      .resolves.toBeUndefined();
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    expect(profile).toMatchObject({
      nickname: "tester",
      timezone: "Asia/Seoul",
    });
    expect(profile?.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it("leaves one complete onboarding state after concurrent writes", async () => {
    const repository = repositoryFor(userId, prisma);
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

    await Promise.all([
      repository.complete({ nickname: "first", timezone: "Asia/Seoul" }),
      repository.complete({ nickname: "second", timezone: "Asia/Seoul" }),
    ]);

    await expect(prisma.userProfile.count({ where: { userId } })).resolves.toBe(1);
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    expect(["first", "second"]).toContain(profile.nickname);
    expect(profile.onboardingCompletedAt).toBeInstanceOf(Date);
  });
});
