import type { Prisma } from "../src/generated/prisma/client";
import { buildAnalysisNarrationFacts } from "../src/modules/narration/domain/types";
import { getPrismaClient } from "../src/shared/db/prisma";
import { VISUAL_FIXTURE_NOW } from "../src/shared/time/visual-server-clock";
import type { VisualFixture } from "../tests/visual/manifest";

const FIXTURE_NOW = VISUAL_FIXTURE_NOW;
const TIMEZONE = "Asia/Seoul";

export const visualAnalysisResult = {
  readiness: 78,
  confidence: "medium",
  metrics: {
    sleepRhythmStability: 81,
    phoneWindDown: 74,
    caffeineSignal: 69,
    sleepGoalAttainment: 84,
  },
  dataBasis: {
    periodStart: "2026-08-06",
    periodEnd: "2026-08-19",
    sampleCount: 14,
    excludedCount: 0,
    missingFields: [],
    completenessByCategory: { sleep: 1, phone: 1, caffeine: 1, alcohol: 1, meal: 1, exercise: 1, wellness: 1 },
    sourceDistribution: { manual: 1 },
    computedAt: FIXTURE_NOW.toISOString(),
    algorithmVersion: "provisional-v1",
    confidence: "medium",
  },
  evidence: [{ code: "sleep-impact-positive-association", label: "규칙적인 취침 시간이 수면 리듬과 함께 관찰됐어요.", direction: "positive", value: 24, count: 14 }],
  missingFields: [],
} as const;

export const visualNarrationOutput = {
  headline: "현재 기록으로 본 수면 준비 상태",
  body: "최근 기록을 바탕으로 오늘의 수면 준비 상태를 정리했어요.",
  bullets: ["최근 14일 기록을 사용했어요.", "기록을 이어가면 패턴을 더 정확히 볼 수 있어요."],
} as const;

const assertVisualFixtureEnvironment = (): void => {
  if (process.env.NODE_ENV !== "test" && process.env.VISUAL_TEST !== "1") {
    throw new Error("VISUAL_FIXTURE_ENVIRONMENT_REQUIRED");
  }
};

const clearDomainRows = async (transaction: Prisma.TransactionClient, userId: string): Promise<void> => {
  await transaction.narration.deleteMany({ where: { userId } });
  await transaction.impactFactor.deleteMany({ where: { analysisSnapshot: { userId } } });
  await transaction.analysisSnapshot.deleteMany({ where: { userId } });
  await transaction.baselineSnapshot.deleteMany({ where: { userId } });
  await transaction.planRevision.deleteMany({ where: { userId } });
  await transaction.planDay.deleteMany({ where: { userId } });
  await transaction.scheduleAdvice.deleteMany({ where: { userId } });
  await transaction.sleepPlan.deleteMany({ where: { userId } });
  await transaction.specialEvent.deleteMany({ where: { userId } });
  await transaction.routineCompletion.deleteMany({ where: { userId } });
  await transaction.careToolSession.deleteMany({ where: { userId } });
  await transaction.recordRevision.deleteMany({ where: { userId } });
  await transaction.sleepSession.deleteMany({ where: { userId } });
  await transaction.phoneUsageEntry.deleteMany({ where: { userId } });
  await transaction.caffeineEntry.deleteMany({ where: { userId } });
  await transaction.alcoholEntry.deleteMany({ where: { userId } });
  await transaction.mealEntry.deleteMany({ where: { userId } });
  await transaction.exerciseEntry.deleteMany({ where: { userId } });
  await transaction.wellnessEntry.deleteMany({ where: { userId } });
  await transaction.mutationReceipt.deleteMany({ where: { userId } });
  await transaction.dailyLog.deleteMany({ where: { userId } });
  await transaction.connection.deleteMany({ where: { userId } });
  await transaction.userHabit.deleteMany({ where: { userId } });
  await transaction.sleepGoal.deleteMany({ where: { userId } });
  await transaction.userProfile.deleteMany({ where: { userId } });
};

export const seedVisualFixtureData = async (fixture: VisualFixture, email: string): Promise<void> => {
  assertVisualFixtureEnvironment();
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error("VISUAL_FIXTURE_USER_NOT_FOUND");

  await prisma.$transaction(async (transaction) => {
    await clearDomainRows(transaction, user.id);
    if (fixture === "new-user") return;

    const onboardingComplete = fixture === "complete-user" || fixture === "planned-user" || fixture.endsWith("draft") || fixture.includes("brand") || fixture.includes("type") || fixture.includes("amount") || fixture.includes("meal") || fixture.includes("sleep") || fixture.includes("phone");
    await transaction.userProfile.create({ data: { userId: user.id, nickname: "Visual User", timezone: TIMEZONE, onboardingCompletedAt: onboardingComplete ? FIXTURE_NOW : null } });
    if (fixture === "onboarding-profile") return;

    await transaction.userHabit.create({ data: { userId: user.id, caffeine: "sometimes", exercise: "weekly", meal: "mixed", alcohol: "weekly", phoneUsage: "medium" } });
    if (fixture === "onboarding-habits") return;

    await transaction.sleepGoal.create({ data: { userId: user.id, targetBedTime: "23:30", targetWakeTime: "07:00", targetDurationMinutes: 450 } });
    if (fixture === "onboarding-goal") return;

    await transaction.connection.create({ data: { userId: user.id, selected: "manual", mode: "manual", availability: "available", state: "complete" } });

    const log = await transaction.dailyLog.create({ data: { userId: user.id, localDate: "2026-08-19", timezone: TIMEZONE } });
    await transaction.sleepSession.create({ data: { userId: user.id, dailyLogId: log.id, sleepDate: "2026-08-19", startedAt: new Date("2026-08-18T14:00:00.000Z"), endedAt: new Date("2026-08-18T22:00:00.000Z"), morningFatigue: 2, timezone: TIMEZONE } });
    await transaction.careToolSession.create({ data: { userId: user.id, localDate: "2026-08-19", toolKey: "breathing", startedAt: FIXTURE_NOW, plannedDurationSeconds: 180 } });
    if (fixture === "complete-user") {
      const snapshot = await transaction.analysisSnapshot.create({ data: { userId: user.id, localDate: "2026-08-19", timezone: TIMEZONE, status: "current", result: { schemaVersion: 1, baselineSnapshotId: "visual-baseline-snapshot", analysisResult: visualAnalysisResult }, generatedAt: FIXTURE_NOW, currentKey: `${user.id}:2026-08-19` } });
      await transaction.narration.create({ data: { userId: user.id, analysisSnapshotId: snapshot.id, scheduleAdviceId: null, provider: "template", model: null, inputHash: "visual-analysis-template-v1", facts: buildAnalysisNarrationFacts(snapshot.id, visualAnalysisResult), output: { schemaVersion: 1, ...visualNarrationOutput }, status: "template-fallback", retryCount: 0, generatedAt: FIXTURE_NOW } });
    }
    if (fixture !== "planned-user") return;

    const plan = await transaction.sleepPlan.create({ data: { userId: user.id, timezone: TIMEZONE, status: "active", activeKey: user.id } });
    await transaction.planDay.createMany({ data: [0, 1, 2].map((offset) => {
      const bedAt = new Date(Date.UTC(2026, 7, 19 + offset, 14, 0));
      const wakeAt = new Date(bedAt.getTime() + 8 * 60 * 60_000);
      return { userId: user.id, planId: plan.id, localDate: wakeAt.toISOString().slice(0, 10), timezone: TIMEZONE, targetBedAt: bedAt, targetWakeAt: wakeAt, caffeineCutoffAt: new Date(bedAt.getTime() - 2 * 60 * 60_000), exerciseCutoffAt: new Date(bedAt.getTime() - 90 * 60_000), mealCutoffAt: new Date(bedAt.getTime() - 60 * 60_000), windDownAt: new Date(bedAt.getTime() - 30 * 60_000), status: "active", activeKey: `${plan.id}:${wakeAt.toISOString().slice(0, 10)}` };
    }) });
  });
};
