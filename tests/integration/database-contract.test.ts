import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPrismaClient } from "@/shared/db/prisma";
import { createTestPrismaClient } from "../support/prisma-client";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isContractDatabase = (
  (/^file:.*contract/i.test(databaseUrl) && !/(?:prod(?:uction)?|dev(?:elopment)?|shared|staging|main|default)/i.test(databaseUrl))
  || /^postgresql:\/\/[^/]+@(?:127\.0\.0\.1|localhost)(?::\d+)?\/planner_test(?:\?|$)/i.test(databaseUrl)
);
const describeContract = isContractDatabase ? describe : describe.skip;
const prisma = createTestPrismaClient(databaseUrl || "file:./prisma/unused-contract.sqlite");

const now = new Date("2026-08-19T12:00:00.000Z");
const timezone = "Asia/Seoul";
const alice = "contract-alice";
const bob = "contract-bob";
const cascadeUser = "contract-cascade";

const isUniqueViolation = (error: unknown): boolean => (
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
);

const isForeignKeyViolation = (error: unknown): boolean => (
  typeof error === "object" && error !== null && "code" in error && error.code === "P2003"
);

const clean = async (userId: string): Promise<void> => {
  await prisma.rateLimit.deleteMany({ where: { key: `${userId}:rate-limit` } });
  await prisma.narration.deleteMany({ where: { userId } });
  await prisma.impactFactor.deleteMany({ where: { analysisSnapshot: { userId } } });
  await prisma.analysisSnapshot.deleteMany({ where: { userId } });
  await prisma.baselineSnapshot.deleteMany({ where: { userId } });
  await prisma.planRevision.deleteMany({ where: { userId } });
  await prisma.planDay.deleteMany({ where: { userId } });
  await prisma.scheduleAdvice.deleteMany({ where: { userId } });
  await prisma.sleepPlan.deleteMany({ where: { userId } });
  await prisma.specialEvent.deleteMany({ where: { userId } });
  await prisma.routineCompletion.deleteMany({ where: { userId } });
  await prisma.careToolSession.deleteMany({ where: { userId } });
  await prisma.recordRevision.deleteMany({ where: { userId } });
  await prisma.sleepSession.deleteMany({ where: { userId } });
  await prisma.caffeineEntry.deleteMany({ where: { userId } });
  await prisma.alcoholEntry.deleteMany({ where: { userId } });
  await prisma.mealEntry.deleteMany({ where: { userId } });
  await prisma.exerciseEntry.deleteMany({ where: { userId } });
  await prisma.phoneUsageEntry.deleteMany({ where: { userId } });
  await prisma.wellnessEntry.deleteMany({ where: { userId } });
  await prisma.mutationReceipt.deleteMany({ where: { userId } });
  await prisma.dailyLog.deleteMany({ where: { userId } });
  await prisma.connection.deleteMany({ where: { userId } });
  await prisma.userHabit.deleteMany({ where: { userId } });
  await prisma.sleepGoal.deleteMany({ where: { userId } });
  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.verification.deleteMany({ where: { identifier: `${userId}@example.invalid` } });
  await prisma.user.deleteMany({ where: { id: userId } });
};

const createUser = async (userId: string): Promise<void> => {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid`, createdAt: now, updatedAt: now } });
  await prisma.userProfile.create({ data: { userId, nickname: userId, timezone, onboardingCompletedAt: now } });
  await prisma.sleepGoal.create({ data: { userId, targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 } });
  await prisma.userHabit.create({ data: { userId, caffeine: "sometimes", exercise: "light", meal: "regular", phoneUsage: "low" } });
  await prisma.connection.create({ data: { userId, selected: "manual", mode: "manual", availability: "available", state: "complete" } });
  await prisma.account.create({ data: { id: `${userId}-account`, accountId: userId, providerId: "credential", userId } });
  await prisma.session.create({ data: { id: `${userId}-session`, token: `${userId}-token`, userId, expiresAt: new Date(now.getTime() + 60_000) } });
  await prisma.verification.create({ data: { id: `${userId}-verification`, identifier: `${userId}@example.invalid`, value: `${userId}-verification`, expiresAt: new Date(now.getTime() + 60_000) } });
  await prisma.rateLimit.create({ data: { id: `${userId}-rate-limit`, key: `${userId}:rate-limit`, count: 1, lastRequest: BigInt(now.getTime()) } });
};

export const runDatabaseContract = async () => {
  await createUser(alice);
  await createUser(bob);

  const firstLog = await prisma.dailyLog.create({ data: { userId: alice, localDate: "2026-08-18", timezone } });
  const secondLog = await prisma.dailyLog.create({ data: { userId: alice, localDate: "2026-08-19", timezone } });
  await prisma.dailyLog.create({ data: { userId: bob, localDate: "2026-08-19", timezone } });
  await prisma.sleepSession.create({ data: { userId: alice, dailyLogId: firstLog.id, sleepDate: firstLog.localDate, startedAt: now, endedAt: new Date(now.getTime() + 480 * 60_000), morningFatigue: 2, timezone } });
  await prisma.caffeineEntry.create({ data: { userId: alice, dailyLogId: secondLog.id, brand: "test", product: "coffee", caffeineMg: 100, consumedAt: now, timezone } });
  await prisma.alcoholEntry.create({ data: { userId: alice, dailyLogId: secondLog.id, alcoholType: "none", servings: 0, consumedAt: now, timezone } });
  await prisma.mealEntry.create({ data: { userId: alice, dailyLogId: secondLog.id, size: "medium", eatenAt: now, timezone } });
  await prisma.exerciseEntry.create({ data: { userId: alice, dailyLogId: secondLog.id, exerciseType: "walk", intensity: "light", startedAt: now, endedAt: new Date(now.getTime() + 30 * 60_000), timezone } });
  await prisma.phoneUsageEntry.create({ data: { userId: alice, dailyLogId: secondLog.id, localDate: secondLog.localDate, lastUseAt: now, durationMinutes: 15, timezone } });
  await prisma.wellnessEntry.create({ data: { userId: alice, dailyLogId: secondLog.id, localDate: secondLog.localDate, fatigueLevel: 2, stressLevel: 2, timezone } });
  await prisma.recordRevision.create({ data: { userId: alice, entityType: "caffeine", entityId: "contract-caffeine", operation: "create", after: { schemaVersion: 1, caffeineMg: 100 } } });
  await prisma.mutationReceipt.create({ data: { userId: alice, operation: "record.create", idempotencyKey: "contract-key", requestHash: "contract-hash", status: "completed", expiresAt: new Date(now.getTime() + 60_000) } });
  await prisma.baselineSnapshot.create({ data: { userId: alice, timezone, status: "current", result: { schemaVersion: 1 }, currentKey: `${alice}:baseline` } });
  const snapshot = await prisma.analysisSnapshot.create({ data: { userId: alice, localDate: secondLog.localDate, timezone, status: "current", result: { schemaVersion: 1, readiness: 80 }, currentKey: `${alice}:${secondLog.localDate}` } });
  await prisma.impactFactor.create({ data: { analysisSnapshotId: snapshot.id, factor: "caffeine", exposedCount: 1, unexposedCount: 1, confidence: "low", evidence: { schemaVersion: 1 } } });
  const plan = await prisma.sleepPlan.create({ data: { userId: alice, timezone, status: "active", activeKey: `${alice}:active` } });
  const day = await prisma.planDay.create({ data: { userId: alice, planId: plan.id, localDate: secondLog.localDate, timezone, targetBedAt: now, targetWakeAt: new Date(now.getTime() + 480 * 60_000), caffeineCutoffAt: now, exerciseCutoffAt: now, mealCutoffAt: now, windDownAt: now, status: "active", activeKey: `${plan.id}:${secondLog.localDate}` } });
  const event = await prisma.specialEvent.create({ data: { userId: alice, title: "contract event", type: "travel", startsAt: now, localDate: secondLog.localDate, timezone } });
  const advice = await prisma.scheduleAdvice.create({ data: { userId: alice, eventId: event.id, triggerType: "event", status: "pending", algorithmVersion: "contract", inputHash: "contract-event", inputSnapshot: { schemaVersion: 1 }, proposal: { schemaVersion: 1 }, confidence: "low" } });
  await prisma.planRevision.create({ data: { userId: alice, planId: plan.id, triggerType: "event", triggerEntityType: "event", triggerEntityId: event.id, sourceAdviceId: advice.id, beforeSnapshot: { schemaVersion: 1 }, afterSnapshot: { schemaVersion: 1 }, reason: "contract" } });
  await prisma.narration.create({ data: { userId: alice, analysisSnapshotId: snapshot.id, provider: "template", inputHash: "contract-analysis", facts: { schemaVersion: 1 }, output: { schemaVersion: 1 }, status: "template-fallback" } });
  await prisma.routineCompletion.create({ data: { userId: alice, localDate: secondLog.localDate, planDayId: day.id, routineRevisionKey: plan.id, stepKey: "wind-down", completedAt: now } });
  await prisma.careToolSession.create({ data: { userId: alice, localDate: secondLog.localDate, toolKey: "breathing", startedAt: now, plannedDurationSeconds: 180 } });

  const routineOwnership = await prisma.routineCompletion.create({
    data: {
      userId: bob,
      localDate: secondLog.localDate,
      planDayId: day.id,
      routineRevisionKey: "foreign-plan-day",
      stepKey: "wind-down",
      completedAt: now,
    },
  }).then(() => false).catch(isForeignKeyViolation);
  const narrationOwnership = await prisma.narration.create({
    data: {
      userId: bob,
      scheduleAdviceId: advice.id,
      provider: "template",
      inputHash: "foreign-advice",
      facts: { schemaVersion: 1 },
      output: { schemaVersion: 1 },
      status: "template-fallback",
    },
  }).then(() => false).catch(isForeignKeyViolation);

  const dailyLogCompositeUnique = await prisma.dailyLog.create({ data: { userId: alice, localDate: secondLog.localDate, timezone } }).then(() => false).catch(isUniqueViolation);
  const activeKeyInvariant = await prisma.sleepPlan.create({ data: { userId: alice, timezone, status: "active", activeKey: plan.activeKey } }).then(() => false).catch(isUniqueViolation);
  const currentKeyInvariant = await prisma.analysisSnapshot.create({ data: { userId: alice, localDate: "2026-08-20", timezone, status: "current", result: { schemaVersion: 1 }, currentKey: snapshot.currentKey } }).then(() => false).catch(isUniqueViolation);
  const versionedJsonRoundTrip = (await prisma.analysisSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } })).result;
  const orderedLocalDates = (await prisma.dailyLog.findMany({ where: { userId: alice }, orderBy: { localDate: "asc" }, select: { localDate: true } })).map(({ localDate }) => localDate);
  const isolatedUsers = (await prisma.dailyLog.count({ where: { userId: alice } })) === 2 && (await prisma.dailyLog.count({ where: { userId: bob } })) === 1;

  await createUser(cascadeUser);
  const cascadeLog = await prisma.dailyLog.create({ data: { userId: cascadeUser, localDate: "2026-08-19", timezone } });
  await prisma.caffeineEntry.create({ data: { userId: cascadeUser, dailyLogId: cascadeLog.id, brand: "test", product: "coffee", caffeineMg: 100, consumedAt: now, timezone } });
  await prisma.user.delete({ where: { id: cascadeUser } });
  const userCascade = (await prisma.dailyLog.count({ where: { userId: cascadeUser } })) === 0 && (await prisma.caffeineEntry.count({ where: { userId: cascadeUser } })) === 0;
  const onboardingCascade = await Promise.all([
    prisma.userProfile.count({ where: { userId: cascadeUser } }),
    prisma.sleepGoal.count({ where: { userId: cascadeUser } }),
    prisma.userHabit.count({ where: { userId: cascadeUser } }),
    prisma.connection.count({ where: { userId: cascadeUser } }),
  ]).then((counts) => counts.every((count) => count === 0));

  const transactionRolledBack = await prisma.$transaction(async (transaction) => {
    await transaction.user.create({ data: { id: "contract-rollback", email: "contract-rollback@example.invalid" } });
    throw new Error("contract rollback");
  }).then(() => false).catch(async () => (await prisma.user.count({ where: { id: "contract-rollback" } })) === 0);

  return {
    isolatedUsers,
    versionedJsonRoundTrip: JSON.stringify(versionedJsonRoundTrip) === JSON.stringify({ schemaVersion: 1, readiness: 80 }),
    dailyLogCompositeUnique,
    activeKeyInvariant,
    currentKeyInvariant,
    userCascade,
    onboardingCascade,
    routineOwnership,
    narrationOwnership,
    transactionRolledBack,
    orderedLocalDates,
  };
};

describeContract("database contract", () => {
  beforeAll(async () => {
    await Promise.all([clean(alice), clean(bob), clean(cascadeUser), clean("contract-rollback")]);
  });

  afterAll(async () => {
    await Promise.all([clean(alice), clean(bob), clean(cascadeUser), clean("contract-rollback")]);
    await prisma.$disconnect();
  });

  it("preserves ownership, JSON, unique keys, cascade, ordering, and rollback", async () => {
    await expect(runDatabaseContract()).resolves.toEqual({
      isolatedUsers: true,
      versionedJsonRoundTrip: true,
      dailyLogCompositeUnique: true,
      activeKeyInvariant: true,
      currentKeyInvariant: true,
      userCascade: true,
      onboardingCascade: true,
      routineOwnership: true,
      narrationOwnership: true,
      transactionRolledBack: true,
      orderedLocalDates: ["2026-08-18", "2026-08-19"],
    });
  });
});

describe("Prisma adapter factory", () => {
  it("connects to SQLite through an explicit Prisma 7 adapter", async () => {
    const databaseDirectory = await mkdtemp(join(tmpdir(), "adaptive-sleep-prisma-"));
    const prisma = createPrismaClient(`file:${join(databaseDirectory, "adapter-test.db")}`);

    try {
      await expect(prisma.$queryRaw`SELECT 1 AS value`).resolves.toBeDefined();
    } finally {
      await prisma.$disconnect();
      await rm(databaseDirectory, { recursive: true, force: true });
    }
  });
});
