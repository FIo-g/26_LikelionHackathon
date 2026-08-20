import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestPrismaClient } from "../support/prisma-client";
import { createUpdateProfileService } from "@/modules/account/application/update-profile";
import { createUpdateSleepGoalService } from "@/modules/account/application/update-sleep-goal";
import { createPrismaAccountRepository } from "@/modules/account/infrastructure/prisma-account-repository";

const aliceScope = { userId: "alice", timezone: "Asia/Seoul" };

describe("Account settings mutations", () => {
  it("updates only the authenticated profile and never accepts a foreign profile target", async () => {
    const profiles = new Map([
      ["alice", { nickname: "Alice", timezone: "Asia/Seoul" }],
      ["bob", { nickname: "Bob", timezone: "America/New_York" }],
    ]);
    const repository = {
      updateProfile: vi.fn(async (scope: typeof aliceScope, input: { nickname: string; timezone: string }) => {
        profiles.set(scope.userId, input);
      }),
    };
    const service = createUpdateProfileService(aliceScope, { repository: repository as never });

    await service.update({ nickname: "Alice Updated", timezone: "Europe/London", profileId: "bob" } as { nickname: string; timezone: string } & { profileId: string });

    expect(profiles.get("alice")).toEqual({ nickname: "Alice Updated", timezone: "Europe/London" });
    expect(profiles.get("bob")).toEqual({ nickname: "Bob", timezone: "America/New_York" });
    expect(repository.updateProfile).toHaveBeenCalledWith(aliceScope, { nickname: "Alice Updated", timezone: "Europe/London" });
  });

  it("derives duration on the server and supersedes goal-dependent state through the scoped repository", async () => {
    const repository = { updateSleepGoal: vi.fn().mockResolvedValue(undefined) };
    const service = createUpdateSleepGoalService(aliceScope, { repository: repository as never });

    await service.update({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 1 } as { targetBedTime: string; targetWakeTime: string } & { targetDurationMinutes: number });

    expect(repository.updateSleepGoal).toHaveBeenCalledWith(aliceScope, {
      targetBedTime: "23:00",
      targetWakeTime: "07:00",
      targetDurationMinutes: 480,
    });
  });
});

const sqliteUrl = process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : null;
const describeSqlite = sqliteUrl ? describe : describe.skip;
const persistedAlice = { userId: "account-sqlite-alice", timezone: "Asia/Seoul" };
const persistedBob = { userId: "account-sqlite-bob", timezone: "Asia/Seoul" };
const now = new Date("2026-08-20T03:00:00.000Z");
const prisma = createTestPrismaClient(sqliteUrl ?? "file:./prisma/unused-account-settings.sqlite");

describeSqlite("Account Prisma transaction contract", () => {
  beforeAll(async () => {
    await prisma.analysisSnapshot.deleteMany({ where: { userId: { in: [persistedAlice.userId, persistedBob.userId] } } });
    await prisma.scheduleAdvice.deleteMany({ where: { userId: { in: [persistedAlice.userId, persistedBob.userId] } } });
    await prisma.planDay.deleteMany({ where: { userId: { in: [persistedAlice.userId, persistedBob.userId] } } });
    await prisma.sleepPlan.deleteMany({ where: { userId: { in: [persistedAlice.userId, persistedBob.userId] } } });
    for (const userId of [persistedAlice.userId, persistedBob.userId]) {
      await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });
      await prisma.userProfile.upsert({ where: { userId }, update: { nickname: userId, timezone: "Asia/Seoul", onboardingCompletedAt: now }, create: { userId, nickname: userId, timezone: "Asia/Seoul", onboardingCompletedAt: now } });
      await prisma.sleepGoal.upsert({ where: { userId }, update: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }, create: { userId, targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 } });
    }
    const alicePlan = await prisma.sleepPlan.create({ data: { userId: persistedAlice.userId, timezone: "Asia/Seoul", status: "active", activeKey: "account-sqlite-alice" } });
    const bobPlan = await prisma.sleepPlan.create({ data: { userId: persistedBob.userId, timezone: "Asia/Seoul", status: "active", activeKey: "account-sqlite-bob" } });
    const day = (userId: string, planId: string, activeKey: string) => ({ userId, planId, localDate: "2026-08-20", timezone: "Asia/Seoul", targetBedAt: now, targetWakeAt: new Date(now.getTime() + 480 * 60_000), caffeineCutoffAt: now, exerciseCutoffAt: now, mealCutoffAt: now, windDownAt: now, status: "active", activeKey });
    await prisma.planDay.createMany({ data: [day(persistedAlice.userId, alicePlan.id, "account-sqlite-alice-day"), day(persistedBob.userId, bobPlan.id, "account-sqlite-bob-day")] });
    const advice = (userId: string, planId: string, inputHash: string) => ({ userId, eventId: null, planId, triggerType: "reroute", status: "generated", algorithmVersion: "provisional-v1", inputHash, inputSnapshot: {}, proposal: {}, confidence: "low" });
    await prisma.scheduleAdvice.createMany({ data: [advice(persistedAlice.userId, alicePlan.id, "account-sqlite-alice-advice"), advice(persistedBob.userId, bobPlan.id, "account-sqlite-bob-advice")] });
    await prisma.analysisSnapshot.createMany({ data: [
      { userId: persistedAlice.userId, localDate: "2026-08-10", timezone: "Asia/Seoul", status: "current", result: {}, currentKey: "account-sqlite-alice-history" },
      { userId: persistedAlice.userId, localDate: "2026-08-20", timezone: "Asia/Seoul", status: "current", result: {}, currentKey: "account-sqlite-alice-current" },
      { userId: persistedBob.userId, localDate: "2026-08-20", timezone: "Asia/Seoul", status: "current", result: {}, currentKey: "account-sqlite-bob-current" },
    ] });
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it("scopes persisted timezone and goal transactions to the owned user while preserving historical snapshots", async () => {
    const repository = createPrismaAccountRepository(prisma as never, { now: () => now });
    await repository.updateProfile(persistedAlice, { nickname: "Alice updated", timezone: "Europe/London" });

    await expect(prisma.userProfile.findUnique({ where: { userId: persistedAlice.userId } })).resolves.toMatchObject({ nickname: "Alice updated", timezone: "Europe/London" });
    await expect(prisma.userProfile.findUnique({ where: { userId: persistedBob.userId } })).resolves.toMatchObject({ nickname: persistedBob.userId, timezone: "Asia/Seoul" });
    await expect(prisma.sleepPlan.findFirst({ where: { userId: persistedAlice.userId } })).resolves.toMatchObject({ status: "superseded" });
    await expect(prisma.sleepPlan.findFirst({ where: { userId: persistedBob.userId } })).resolves.toMatchObject({ status: "active" });
    await expect(prisma.planDay.findFirst({ where: { userId: persistedAlice.userId, localDate: "2026-08-20" } })).resolves.toMatchObject({ status: "superseded" });
    await expect(prisma.planDay.findFirst({ where: { userId: persistedBob.userId, localDate: "2026-08-20" } })).resolves.toMatchObject({ status: "active" });
    await expect(prisma.analysisSnapshot.findFirst({ where: { userId: persistedAlice.userId, localDate: "2026-08-10" } })).resolves.toMatchObject({ status: "current", timezone: "Asia/Seoul" });

    const alicePlan = await prisma.sleepPlan.findFirstOrThrow({ where: { userId: persistedAlice.userId } });
    await prisma.scheduleAdvice.create({ data: { userId: persistedAlice.userId, eventId: null, planId: alicePlan.id, triggerType: "reroute", status: "generated", algorithmVersion: "provisional-v1", inputHash: "account-sqlite-alice-goal-advice", inputSnapshot: {}, proposal: {}, confidence: "low" } });
    await repository.updateSleepGoal({ userId: persistedAlice.userId, timezone: "Europe/London" }, { targetBedTime: "23:30", targetWakeTime: "07:00", targetDurationMinutes: 450 });

    await expect(prisma.sleepGoal.findUnique({ where: { userId: persistedAlice.userId } })).resolves.toMatchObject({ targetDurationMinutes: 450 });
    await expect(prisma.scheduleAdvice.findFirst({ where: { userId: persistedAlice.userId, inputHash: "account-sqlite-alice-goal-advice" } })).resolves.toMatchObject({ status: "superseded" });
    await expect(prisma.scheduleAdvice.findFirst({ where: { userId: persistedBob.userId, inputHash: "account-sqlite-bob-advice" } })).resolves.toMatchObject({ status: "generated" });
  });
});
