import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPrismaClient } from "../support/prisma-client";
import { createDeleteUserAccount } from "@/modules/account/application/delete-user-account";
import { createExportUserData } from "@/modules/account/application/export-user-data";
import { requireRecentAuthentication } from "@/modules/account/application/require-recent-authentication";
import { CorruptStoredPayloadError, ReauthenticationError } from "@/modules/account/domain/export-schema";
import { createPrismaAccountDataRepository } from "@/modules/account/infrastructure/prisma-account-data-repository";

const ACCOUNT_TEST_DATABASE_URL_ENV = "ADAPTIVE_SLEEP_ACCOUNT_TEST_DATABASE_URL";
const accountTestDatabaseUrl = process.env[ACCOUNT_TEST_DATABASE_URL_ENV];
const isDedicatedAccountTestDatabase = typeof accountTestDatabaseUrl === "string"
  && accountTestDatabaseUrl.startsWith("file:")
  && /(?:account[-_]?test|test[-_]?account|e2e|playwright)/i.test(accountTestDatabaseUrl)
  && !/(?:prod(?:uction)?|dev(?:elopment)?|shared|staging|main|default)/i.test(accountTestDatabaseUrl)
  && process.env.DATABASE_URL === accountTestDatabaseUrl;
const describeSqlite = isDedicatedAccountTestDatabase ? describe : describe.skip;
const prisma = createTestPrismaClient(accountTestDatabaseUrl ?? "file:./prisma/unused-account-export.sqlite");
const now = new Date("2026-08-20T03:00:00.000Z");
const clock = { now: () => now };
const alice = { userId: "account-export-alice", timezone: "Asia/Seoul" };
const bob = { userId: "account-export-bob", timezone: "Asia/Seoul" };
const emailFor = (userId: string) => `${userId}@example.test`;

const collectObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectObjectKeys);
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...collectObjectKeys(child)]);
};

const clean = async (userId: string) => {
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
  await prisma.phoneUsageEntry.deleteMany({ where: { userId } });
  await prisma.caffeineEntry.deleteMany({ where: { userId } });
  await prisma.alcoholEntry.deleteMany({ where: { userId } });
  await prisma.mealEntry.deleteMany({ where: { userId } });
  await prisma.exerciseEntry.deleteMany({ where: { userId } });
  await prisma.wellnessEntry.deleteMany({ where: { userId } });
  await prisma.mutationReceipt.deleteMany({ where: { userId } });
  await prisma.dailyLog.deleteMany({ where: { userId } });
  await prisma.connection.deleteMany({ where: { userId } });
  await prisma.userHabit.deleteMany({ where: { userId } });
  await prisma.sleepGoal.deleteMany({ where: { userId } });
  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.verification.deleteMany({ where: { identifier: emailFor(userId) } });
  await prisma.user.deleteMany({ where: { id: userId } });
};

const seed = async (scope: typeof alice | typeof bob) => {
  const email = emailFor(scope.userId);
  await prisma.user.create({ data: { id: scope.userId, name: scope.userId, email, emailVerified: false, createdAt: now, updatedAt: now } });
  await prisma.userProfile.create({
    data: {
      userId: scope.userId,
      nickname: scope.userId,
      timezone: scope.timezone,
      age: 28,
      gender: "prefer-not-to-say",
      heightCm: 171,
      weightKg: 62.5,
      onboardingCompletedAt: now,
    },
  });
  await prisma.sleepGoal.create({ data: { userId: scope.userId, targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 } });
  await prisma.userHabit.create({ data: { userId: scope.userId, caffeine: "sometimes", exercise: "light", meal: "regular", alcohol: "monthly", phoneUsage: "moderate" } });
  await prisma.connection.create({ data: { userId: scope.userId, selected: "manual", mode: "manual", availability: "available", state: "complete" } });
  const dailyLog = await prisma.dailyLog.create({ data: { userId: scope.userId, localDate: "2026-08-20", timezone: scope.timezone } });
  await prisma.sleepSession.create({ data: { userId: scope.userId, dailyLogId: dailyLog.id, sleepDate: "2026-08-20", startedAt: new Date("2026-08-19T14:00:00.000Z"), endedAt: new Date("2026-08-19T22:00:00.000Z"), morningFatigue: 2, timezone: scope.timezone } });
  await prisma.recordRevision.create({ data: { userId: scope.userId, entityType: "sleep", entityId: `${scope.userId}-sleep`, operation: "create", after: { schemaVersion: 1, record: { id: `${scope.userId}-sleep`, userId: scope.userId, type: "sleep", localDate: "2026-08-20", fields: { startedAt: "2026-08-19T14:00:00.000Z", endedAt: "2026-08-19T22:00:00.000Z", morningFatigue: 2, timezone: scope.timezone } } }, changedAt: now } });
  await prisma.routineCompletion.create({ data: { userId: scope.userId, localDate: "2026-08-20", planDayId: null, routineRevisionKey: "goal:revision", stepKey: "wind-down", completedAt: now } });
  await prisma.careToolSession.create({ data: { userId: scope.userId, localDate: "2026-08-20", toolKey: "breathing", startedAt: now, plannedDurationSeconds: 180 } });
  await prisma.account.create({ data: { id: `${scope.userId}-account`, userId: scope.userId, accountId: scope.userId, providerId: "credential", password: "not-exported", createdAt: now, updatedAt: now } });
  await prisma.session.create({ data: { id: `${scope.userId}-session`, userId: scope.userId, token: `${scope.userId}-token`, expiresAt: new Date(now.getTime() + 60_000), createdAt: now, updatedAt: now } });
  await prisma.verification.create({ data: { id: `${scope.userId}-verification`, identifier: email, value: `${scope.userId}-verification-value`, expiresAt: new Date(now.getTime() + 60_000), createdAt: now, updatedAt: now } });
};

describeSqlite("account export and atomic deletion", () => {
  beforeAll(async () => {
    await clean(alice.userId);
    await clean(bob.userId);
    await seed(alice);
    await seed(bob);
  });

  afterAll(async () => {
    await clean(alice.userId);
    await clean(bob.userId);
    await prisma.$disconnect();
  });

  it("exports only validated domain data and never auth credentials", async () => {
    const exported = await createExportUserData(createPrismaAccountDataRepository(prisma), clock)(alice);
    const keys = collectObjectKeys(exported);
    expect(exported).toMatchObject({
      schemaVersion: 1,
      identity: { email: emailFor(alice.userId) },
      profile: { age: 28, gender: "prefer-not-to-say", heightCm: 171, weightKg: 62.5 },
      habits: expect.arrayContaining([{ category: "alcohol", value: "monthly" }]),
      records: [{ type: "sleep" }],
    });
    expect(Object.keys(exported)).not.toEqual(expect.arrayContaining(["user", "accounts", "sessions", "verifications", "rateLimits"]));
    expect(keys).not.toEqual(expect.arrayContaining(["password", "accessToken", "refreshToken", "idToken", "sessionToken", "verificationToken", "secret", "value", "token"]));
  });

  it("rejects a corrupt persisted narration payload", async () => {
    const snapshot = await prisma.analysisSnapshot.create({
      data: {
        userId: alice.userId,
        localDate: "2026-08-20",
        timezone: alice.timezone,
        status: "current",
        result: {
          schemaVersion: 1,
          baselineSnapshotId: "baseline-for-corrupt-narration-test",
          analysisResult: {
            readiness: null,
            confidence: "insufficient",
            metrics: {
              sleepRhythmStability: null,
              phoneWindDown: null,
              caffeineSignal: null,
              sleepGoalAttainment: null,
            },
            dataBasis: {
              periodStart: "2026-08-20",
              periodEnd: "2026-08-20",
              sampleCount: 0,
              excludedCount: 0,
              missingFields: [],
              completenessByCategory: { sleep: 0, phone: 0, meal: 0, exercise: 0, caffeine: 0, alcohol: 0, wellness: 0 },
              sourceDistribution: { manual: 0 },
              computedAt: now.toISOString(),
              algorithmVersion: "provisional-v1",
              confidence: "insufficient",
            },
            evidence: [],
            missingFields: [],
          },
        },
        currentKey: `${alice.userId}:corrupt-export`,
      },
    });
    await prisma.narration.create({
      data: { userId: alice.userId, analysisSnapshotId: snapshot.id, provider: "openai", inputHash: "corrupt-export", facts: {}, output: { schemaVersion: 1, headline: "" }, status: "ready" },
    });

    await expect(createExportUserData(createPrismaAccountDataRepository(prisma), clock)(alice)).rejects.toBeInstanceOf(CorruptStoredPayloadError);
  });

  it("requires a valid password verification after the five-minute freshness window", async () => {
    const stale = { userId: alice.userId, email: emailFor(alice.userId), createdAt: new Date(now.getTime() - 5 * 60_000 - 1) };
    await expect(requireRecentAuthentication(stale, null, new Headers(), clock, { api: { verifyPassword: async () => ({ status: true }) } })).rejects.toBeInstanceOf(ReauthenticationError);
    await expect(requireRecentAuthentication(stale, "correct-password", new Headers(), clock, { api: { verifyPassword: async () => ({ status: false }) } })).rejects.toBeInstanceOf(ReauthenticationError);
    await expect(requireRecentAuthentication(stale, "correct-password", new Headers(), clock, { api: { verifyPassword: async () => ({ status: true }) } })).resolves.toBeUndefined();
  });

  it("deletes every owned row while preserving another user", async () => {
    await createDeleteUserAccount({ prisma, clock })({ password: null, confirmationEmail: emailFor(alice.userId), confirmationPhrase: "계정 삭제" }, {
      scope: alice,
      session: { userId: alice.userId, email: emailFor(alice.userId), createdAt: now, sessionId: `${alice.userId}-session` },
      requestHeaders: new Headers(),
    });
    await expect(prisma.user.findUnique({ where: { id: alice.userId } })).resolves.toBeNull();
    await expect(prisma.sleepSession.count({ where: { userId: alice.userId } })).resolves.toBe(0);
    await expect(prisma.account.count({ where: { userId: alice.userId } })).resolves.toBe(0);
    await expect(prisma.user.findUnique({ where: { id: bob.userId } })).resolves.toMatchObject({ email: emailFor(bob.userId) });
    await expect(prisma.sleepSession.count({ where: { userId: bob.userId } })).resolves.toBe(1);
    await expect(prisma.account.count({ where: { userId: bob.userId } })).resolves.toBe(1);
  });

  it("rolls back every owned deletion when a transaction step fails", async () => {
    await seed(alice);
    await expect(createDeleteUserAccount({ prisma, clock, beforeFinalUserDelete: async () => { throw new Error("forced-delete-failure"); } })({ password: null, confirmationEmail: emailFor(alice.userId), confirmationPhrase: "계정 삭제" }, {
      scope: alice,
      session: { userId: alice.userId, email: emailFor(alice.userId), createdAt: now, sessionId: `${alice.userId}-session` },
      requestHeaders: new Headers(),
    })).rejects.toThrow("forced-delete-failure");
    await expect(prisma.user.findUnique({ where: { id: alice.userId } })).resolves.toMatchObject({ email: emailFor(alice.userId) });
    await expect(prisma.sleepSession.count({ where: { userId: alice.userId } })).resolves.toBe(1);
    await expect(prisma.account.count({ where: { userId: alice.userId } })).resolves.toBe(1);
  });
});
