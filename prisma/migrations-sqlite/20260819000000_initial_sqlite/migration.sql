PRAGMA foreign_keys=ON;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issuer" TEXT NOT NULL DEFAULT 'local:credential',
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "timezone" TEXT,
    "onboardingCompletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetBedTime" TEXT NOT NULL,
    "targetWakeTime" TEXT NOT NULL,
    "targetDurationMinutes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SleepGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserHabit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "caffeine" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "phoneUsage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserHabit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "selected" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    CONSTRAINT "DailyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "sleepDate" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "morningFatigue" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SleepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SleepSession_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaffeineEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "caffeineMg" INTEGER NOT NULL,
    "consumedAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaffeineEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaffeineEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlcoholEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "alcoholType" TEXT NOT NULL,
    "servings" REAL NOT NULL,
    "consumedAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlcoholEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlcoholEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "eatenAt" DATETIME NOT NULL,
    "notes" TEXT,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "averageHeartRate" INTEGER,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExerciseEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhoneUsageEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "lastUseAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhoneUsageEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhoneUsageEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellnessEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "fatigueLevel" INTEGER NOT NULL,
    "stressLevel" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WellnessEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WellnessEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecordRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MutationReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "responseJson" JSONB,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MutationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BaselineSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" DATETIME,
    "currentKey" TEXT,
    CONSTRAINT "BaselineSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BaselineSnapshot_current_key_check" CHECK (("status" = 'current') = ("currentKey" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" DATETIME,
    "currentKey" TEXT,
    CONSTRAINT "AnalysisSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnalysisSnapshot_current_key_check" CHECK (("status" = 'current') = ("currentKey" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "ImpactFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "analysisSnapshotId" TEXT NOT NULL,
    "factor" TEXT NOT NULL,
    "exposedCount" INTEGER NOT NULL,
    "unexposedCount" INTEGER NOT NULL,
    "deltaMinutes" REAL,
    "confidence" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    CONSTRAINT "ImpactFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImpactFactor_analysisSnapshotId_userId_fkey" FOREIGN KEY ("analysisSnapshotId", "userId") REFERENCES "AnalysisSnapshot" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "localDate" TEXT NOT NULL,
    "desiredWakeAt" DATETIME,
    "notes" TEXT,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleAdvice" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleAdvice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAdvice_eventId_userId_fkey" FOREIGN KEY ("eventId", "userId") REFERENCES "SpecialEvent" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAdvice_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAdvice_target_matches_trigger_check" CHECK (("triggerType" = 'event' AND "eventId" IS NOT NULL AND "planId" IS NULL) OR ("triggerType" = 'reroute' AND "eventId" IS NULL AND "planId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "Narration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "analysisSnapshotId" TEXT,
    "scheduleAdviceId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "inputHash" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Narration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Narration_analysisSnapshotId_userId_fkey" FOREIGN KEY ("analysisSnapshotId", "userId") REFERENCES "AnalysisSnapshot" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Narration_scheduleAdviceId_userId_fkey" FOREIGN KEY ("scheduleAdviceId", "userId") REFERENCES "ScheduleAdvice" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Narration_exactly_one_target_check" CHECK (("analysisSnapshotId" IS NULL) <> ("scheduleAdviceId" IS NULL))
);

-- CreateTable
CREATE TABLE "RoutineCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "planDayId" TEXT,
    "routineRevisionKey" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoutineCompletion_planDayId_userId_fkey" FOREIGN KEY ("planDayId", "userId") REFERENCES "PlanDay" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareToolSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "plannedDurationSeconds" INTEGER NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareToolSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "activeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SleepPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SleepPlan_active_key_check" CHECK (("status" = 'active') = ("activeKey" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "targetBedAt" DATETIME NOT NULL,
    "targetWakeAt" DATETIME NOT NULL,
    "caffeineCutoffAt" DATETIME NOT NULL,
    "exerciseCutoffAt" DATETIME NOT NULL,
    "mealCutoffAt" DATETIME NOT NULL,
    "windDownAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "activeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanDay_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanDay_active_key_check" CHECK (("status" = 'active') = ("activeKey" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "PlanRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerEntityType" TEXT,
    "triggerEntityId" TEXT,
    "sourceAdviceId" TEXT,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanRevision_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanRevision_sourceAdviceId_userId_fkey" FOREIGN KEY ("sourceAdviceId", "userId") REFERENCES "ScheduleAdvice" ("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanRevision_trigger_pair_check" CHECK (("triggerEntityType" IS NULL) = ("triggerEntityId" IS NULL))
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
CREATE INDEX "ImpactFactor_userId_analysisSnapshotId_idx" ON "ImpactFactor"("userId", "analysisSnapshotId");

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
CREATE UNIQUE INDEX "RoutineCompletion_userId_localDate_routineRevisionKey_stepKey_key" ON "RoutineCompletion"("userId", "localDate", "routineRevisionKey", "stepKey");

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
