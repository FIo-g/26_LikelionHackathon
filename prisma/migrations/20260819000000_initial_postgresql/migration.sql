-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT 'local:credential',
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "timezone" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetBedTime" TEXT NOT NULL,
    "targetWakeTime" TEXT NOT NULL,
    "targetDurationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHabit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caffeine" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "phoneUsage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserHabit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selected" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "sleepDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "morningFatigue" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaffeineEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "caffeineMg" INTEGER NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaffeineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlcoholEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "alcoholType" TEXT NOT NULL,
    "servings" DOUBLE PRECISION NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlcoholEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "eatenAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "averageHeartRate" INTEGER,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneUsageEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "lastUseAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneUsageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "fatigueLevel" INTEGER NOT NULL,
    "stressLevel" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutationReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "responseJson" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "currentKey" TEXT,

    CONSTRAINT "BaselineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "currentKey" TEXT,

    CONSTRAINT "AnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactFactor" (
    "id" TEXT NOT NULL,
    "analysisSnapshotId" TEXT NOT NULL,
    "factor" TEXT NOT NULL,
    "exposedCount" INTEGER NOT NULL,
    "unexposedCount" INTEGER NOT NULL,
    "deltaMinutes" DOUBLE PRECISION,
    "confidence" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "ImpactFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "localDate" TEXT NOT NULL,
    "desiredWakeAt" TIMESTAMP(3),
    "notes" TEXT,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAdvice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "planId" TEXT,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "proposal" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleAdvice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Narration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisSnapshotId" TEXT,
    "scheduleAdviceId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "inputHash" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Narration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "planDayId" TEXT,
    "routineRevisionKey" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareToolSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "plannedDurationSeconds" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareToolSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "targetBedAt" TIMESTAMP(3) NOT NULL,
    "targetWakeAt" TIMESTAMP(3) NOT NULL,
    "caffeineCutoffAt" TIMESTAMP(3) NOT NULL,
    "exerciseCutoffAt" TIMESTAMP(3) NOT NULL,
    "mealCutoffAt" TIMESTAMP(3) NOT NULL,
    "windDownAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerEntityType" TEXT,
    "triggerEntityId" TEXT,
    "sourceAdviceId" TEXT,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "Account"("issuer", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SleepGoal_userId_key" ON "SleepGoal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserHabit_userId_key" ON "UserHabit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_userId_key" ON "Connection"("userId");

-- CreateIndex
CREATE INDEX "DailyLog_userId_timezone_localDate_idx" ON "DailyLog"("userId", "timezone", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_userId_localDate_timezone_key" ON "DailyLog"("userId", "localDate", "timezone");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_id_userId_key" ON "DailyLog"("id", "userId");

-- CreateIndex
CREATE INDEX "SleepSession_userId_sleepDate_idx" ON "SleepSession"("userId", "sleepDate");

-- CreateIndex
CREATE INDEX "RecordRevision_userId_entityType_entityId_idx" ON "RecordRevision"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "MutationReceipt_userId_expiresAt_idx" ON "MutationReceipt"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MutationReceipt_userId_operation_idempotencyKey_key" ON "MutationReceipt"("userId", "operation", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineSnapshot_currentKey_key" ON "BaselineSnapshot"("currentKey");

-- CreateIndex
CREATE INDEX "BaselineSnapshot_userId_timezone_status_generatedAt_idx" ON "BaselineSnapshot"("userId", "timezone", "status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisSnapshot_currentKey_key" ON "AnalysisSnapshot"("currentKey");

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_userId_timezone_status_generatedAt_idx" ON "AnalysisSnapshot"("userId", "timezone", "status", "generatedAt");

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_userId_timezone_localDate_status_idx" ON "AnalysisSnapshot"("userId", "timezone", "localDate", "status");

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_userId_timezone_localDate_idx" ON "AnalysisSnapshot"("userId", "timezone", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisSnapshot_id_userId_key" ON "AnalysisSnapshot"("id", "userId");

-- CreateIndex
CREATE INDEX "ImpactFactor_analysisSnapshotId_idx" ON "ImpactFactor"("analysisSnapshotId");

-- CreateIndex
CREATE INDEX "SpecialEvent_userId_startsAt_idx" ON "SpecialEvent"("userId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialEvent_id_userId_key" ON "SpecialEvent"("id", "userId");

-- CreateIndex
CREATE INDEX "ScheduleAdvice_userId_status_generatedAt_idx" ON "ScheduleAdvice"("userId", "status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAdvice_id_userId_key" ON "ScheduleAdvice"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAdvice_userId_triggerType_inputHash_key" ON "ScheduleAdvice"("userId", "triggerType", "inputHash");

-- CreateIndex
CREATE INDEX "Narration_userId_status_generatedAt_idx" ON "Narration"("userId", "status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Narration_analysisSnapshotId_key" ON "Narration"("analysisSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "Narration_scheduleAdviceId_key" ON "Narration"("scheduleAdviceId");

-- CreateIndex
CREATE INDEX "RoutineCompletion_userId_localDate_idx" ON "RoutineCompletion"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineCompletion_userId_localDate_routineRevisionKey_stepK_key" ON "RoutineCompletion"("userId", "localDate", "routineRevisionKey", "stepKey");

-- CreateIndex
CREATE INDEX "CareToolSession_userId_localDate_toolKey_idx" ON "CareToolSession"("userId", "localDate", "toolKey");

-- CreateIndex
CREATE INDEX "CareToolSession_userId_completedAt_idx" ON "CareToolSession"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SleepPlan_activeKey_key" ON "SleepPlan"("activeKey");

-- CreateIndex
CREATE INDEX "SleepPlan_userId_status_createdAt_idx" ON "SleepPlan"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SleepPlan_id_userId_key" ON "SleepPlan"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_activeKey_key" ON "PlanDay"("activeKey");

-- CreateIndex
CREATE INDEX "PlanDay_userId_localDate_status_idx" ON "PlanDay"("userId", "localDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_id_userId_key" ON "PlanDay"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanRevision_sourceAdviceId_key" ON "PlanRevision"("sourceAdviceId");

-- CreateIndex
CREATE INDEX "PlanRevision_userId_planId_createdAt_idx" ON "PlanRevision"("userId", "planId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanRevision_sourceAdviceId_userId_key" ON "PlanRevision"("sourceAdviceId", "userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepGoal" ADD CONSTRAINT "SleepGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHabit" ADD CONSTRAINT "UserHabit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaffeineEntry" ADD CONSTRAINT "CaffeineEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaffeineEntry" ADD CONSTRAINT "CaffeineEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlcoholEntry" ADD CONSTRAINT "AlcoholEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlcoholEntry" ADD CONSTRAINT "AlcoholEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEntry" ADD CONSTRAINT "ExerciseEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEntry" ADD CONSTRAINT "ExerciseEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneUsageEntry" ADD CONSTRAINT "PhoneUsageEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneUsageEntry" ADD CONSTRAINT "PhoneUsageEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessEntry" ADD CONSTRAINT "WellnessEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessEntry" ADD CONSTRAINT "WellnessEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordRevision" ADD CONSTRAINT "RecordRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutationReceipt" ADD CONSTRAINT "MutationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineSnapshot" ADD CONSTRAINT "BaselineSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactFactor" ADD CONSTRAINT "ImpactFactor_analysisSnapshotId_fkey" FOREIGN KEY ("analysisSnapshotId") REFERENCES "AnalysisSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialEvent" ADD CONSTRAINT "SpecialEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAdvice" ADD CONSTRAINT "ScheduleAdvice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAdvice" ADD CONSTRAINT "ScheduleAdvice_eventId_userId_fkey" FOREIGN KEY ("eventId", "userId") REFERENCES "SpecialEvent"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAdvice" ADD CONSTRAINT "ScheduleAdvice_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narration" ADD CONSTRAINT "Narration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narration" ADD CONSTRAINT "Narration_analysisSnapshotId_userId_fkey" FOREIGN KEY ("analysisSnapshotId", "userId") REFERENCES "AnalysisSnapshot"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narration" ADD CONSTRAINT "Narration_scheduleAdviceId_userId_fkey" FOREIGN KEY ("scheduleAdviceId", "userId") REFERENCES "ScheduleAdvice"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCompletion" ADD CONSTRAINT "RoutineCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCompletion" ADD CONSTRAINT "RoutineCompletion_planDayId_userId_fkey" FOREIGN KEY ("planDayId", "userId") REFERENCES "PlanDay"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareToolSession" ADD CONSTRAINT "CareToolSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepPlan" ADD CONSTRAINT "SleepPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRevision" ADD CONSTRAINT "PlanRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRevision" ADD CONSTRAINT "PlanRevision_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRevision" ADD CONSTRAINT "PlanRevision_sourceAdviceId_userId_fkey" FOREIGN KEY ("sourceAdviceId", "userId") REFERENCES "ScheduleAdvice"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "BaselineSnapshot" ADD CONSTRAINT "BaselineSnapshot_current_key_check" CHECK (("status" = 'current') = ("currentKey" IS NOT NULL));

-- AddCheckConstraint
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_current_key_check" CHECK (("status" = 'current') = ("currentKey" IS NOT NULL));

-- AddCheckConstraint
ALTER TABLE "ScheduleAdvice" ADD CONSTRAINT "ScheduleAdvice_target_matches_trigger_check" CHECK (("triggerType" = 'event' AND "eventId" IS NOT NULL AND "planId" IS NULL) OR ("triggerType" = 'reroute' AND "eventId" IS NULL AND "planId" IS NOT NULL));

-- AddCheckConstraint
ALTER TABLE "Narration" ADD CONSTRAINT "Narration_exactly_one_target_check" CHECK (("analysisSnapshotId" IS NULL) <> ("scheduleAdviceId" IS NULL));

-- AddCheckConstraint
ALTER TABLE "SleepPlan" ADD CONSTRAINT "SleepPlan_active_key_check" CHECK (("status" = 'active') = ("activeKey" IS NOT NULL));

-- AddCheckConstraint
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_active_key_check" CHECK (("status" = 'active') = ("activeKey" IS NOT NULL));

-- AddCheckConstraint
ALTER TABLE "PlanRevision" ADD CONSTRAINT "PlanRevision_trigger_pair_check" CHECK (("triggerEntityType" IS NULL) = ("triggerEntityId" IS NULL));
