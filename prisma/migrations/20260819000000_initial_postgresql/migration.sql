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

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
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
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "DailyLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
  CONSTRAINT "SleepSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SleepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SleepSession_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
  CONSTRAINT "CaffeineEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CaffeineEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CaffeineEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
  CONSTRAINT "AlcoholEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlcoholEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlcoholEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
  CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MealEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MealEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
  CONSTRAINT "ExerciseEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
  CONSTRAINT "PhoneUsageEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PhoneUsageEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PhoneUsageEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
  CONSTRAINT "WellnessEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WellnessEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WellnessEntry_dailyLogId_userId_fkey" FOREIGN KEY ("dailyLogId", "userId") REFERENCES "DailyLog"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "RecordRevision" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecordRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecordRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
  CONSTRAINT "MutationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MutationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BaselineSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  "currentKey" TEXT,
  CONSTRAINT "BaselineSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BaselineSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BaselineSnapshot_current_key_check" CHECK (("status" = 'current') = ("currentKey" IS NOT NULL))
);

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
  CONSTRAINT "AnalysisSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AnalysisSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnalysisSnapshot_current_key_check" CHECK (("status" = 'current') = ("currentKey" IS NOT NULL))
);

CREATE TABLE "ImpactFactor" (
  "id" TEXT NOT NULL,
  "analysisSnapshotId" TEXT NOT NULL,
  "factor" TEXT NOT NULL,
  "exposedCount" INTEGER NOT NULL,
  "unexposedCount" INTEGER NOT NULL,
  "deltaMinutes" DOUBLE PRECISION,
  "confidence" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  CONSTRAINT "ImpactFactor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImpactFactor_analysisSnapshotId_fkey" FOREIGN KEY ("analysisSnapshotId") REFERENCES "AnalysisSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
  CONSTRAINT "SpecialEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpecialEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SleepPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "activeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SleepPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SleepPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SleepPlan_active_key_check" CHECK (("status" = 'active') = ("activeKey" IS NOT NULL))
);

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
  CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanDay_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanDay_active_key_check" CHECK (("status" = 'active') = ("activeKey" IS NOT NULL))
);

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
  CONSTRAINT "ScheduleAdvice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleAdvice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScheduleAdvice_eventId_userId_fkey" FOREIGN KEY ("eventId", "userId") REFERENCES "SpecialEvent"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScheduleAdvice_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScheduleAdvice_target_matches_trigger_check" CHECK (("triggerType" = 'event' AND "eventId" IS NOT NULL AND "planId" IS NULL) OR ("triggerType" = 'reroute' AND "eventId" IS NULL AND "planId" IS NOT NULL))
);

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
  CONSTRAINT "Narration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Narration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Narration_analysisSnapshotId_fkey" FOREIGN KEY ("analysisSnapshotId") REFERENCES "AnalysisSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Narration_scheduleAdviceId_fkey" FOREIGN KEY ("scheduleAdviceId") REFERENCES "ScheduleAdvice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Narration_exactly_one_target_check" CHECK (("analysisSnapshotId" IS NULL) <> ("scheduleAdviceId" IS NULL))
);

CREATE TABLE "RoutineCompletion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "planDayId" TEXT,
  "routineRevisionKey" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoutineCompletion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoutineCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoutineCompletion_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CareToolSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "toolKey" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "plannedDurationSeconds" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareToolSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CareToolSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
  CONSTRAINT "PlanRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanRevision_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "SleepPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanRevision_sourceAdviceId_userId_fkey" FOREIGN KEY ("sourceAdviceId", "userId") REFERENCES "ScheduleAdvice"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlanRevision_trigger_pair_check" CHECK (("triggerEntityType" IS NULL) = ("triggerEntityId" IS NULL))
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE UNIQUE INDEX "SleepGoal_userId_key" ON "SleepGoal"("userId");
CREATE UNIQUE INDEX "UserHabit_userId_key" ON "UserHabit"("userId");
CREATE UNIQUE INDEX "Connection_userId_key" ON "Connection"("userId");
CREATE UNIQUE INDEX "DailyLog_userId_localDate_timezone_key" ON "DailyLog"("userId", "localDate", "timezone");
CREATE UNIQUE INDEX "DailyLog_id_userId_key" ON "DailyLog"("id", "userId");
CREATE INDEX "DailyLog_userId_timezone_localDate_idx" ON "DailyLog"("userId", "timezone", "localDate");
CREATE INDEX "SleepSession_userId_sleepDate_idx" ON "SleepSession"("userId", "sleepDate");
CREATE INDEX "RecordRevision_userId_entityType_entityId_idx" ON "RecordRevision"("userId", "entityType", "entityId");
CREATE UNIQUE INDEX "MutationReceipt_userId_operation_idempotencyKey_key" ON "MutationReceipt"("userId", "operation", "idempotencyKey");
CREATE INDEX "MutationReceipt_userId_expiresAt_idx" ON "MutationReceipt"("userId", "expiresAt");
CREATE UNIQUE INDEX "BaselineSnapshot_currentKey_key" ON "BaselineSnapshot"("currentKey");
CREATE INDEX "BaselineSnapshot_userId_timezone_status_generatedAt_idx" ON "BaselineSnapshot"("userId", "timezone", "status", "generatedAt");
CREATE UNIQUE INDEX "AnalysisSnapshot_currentKey_key" ON "AnalysisSnapshot"("currentKey");
CREATE INDEX "AnalysisSnapshot_userId_timezone_status_generatedAt_idx" ON "AnalysisSnapshot"("userId", "timezone", "status", "generatedAt");
CREATE INDEX "AnalysisSnapshot_userId_timezone_localDate_status_idx" ON "AnalysisSnapshot"("userId", "timezone", "localDate", "status");
CREATE INDEX "AnalysisSnapshot_userId_timezone_localDate_idx" ON "AnalysisSnapshot"("userId", "timezone", "localDate");
CREATE INDEX "ImpactFactor_analysisSnapshotId_idx" ON "ImpactFactor"("analysisSnapshotId");
CREATE UNIQUE INDEX "SpecialEvent_id_userId_key" ON "SpecialEvent"("id", "userId");
CREATE INDEX "SpecialEvent_userId_startsAt_idx" ON "SpecialEvent"("userId", "startsAt");
CREATE UNIQUE INDEX "SleepPlan_activeKey_key" ON "SleepPlan"("activeKey");
CREATE UNIQUE INDEX "SleepPlan_id_userId_key" ON "SleepPlan"("id", "userId");
CREATE INDEX "SleepPlan_userId_status_createdAt_idx" ON "SleepPlan"("userId", "status", "createdAt");
CREATE UNIQUE INDEX "PlanDay_activeKey_key" ON "PlanDay"("activeKey");
CREATE UNIQUE INDEX "PlanDay_id_userId_key" ON "PlanDay"("id", "userId");
CREATE INDEX "PlanDay_userId_localDate_status_idx" ON "PlanDay"("userId", "localDate", "status");
CREATE UNIQUE INDEX "ScheduleAdvice_id_userId_key" ON "ScheduleAdvice"("id", "userId");
CREATE UNIQUE INDEX "ScheduleAdvice_userId_triggerType_inputHash_key" ON "ScheduleAdvice"("userId", "triggerType", "inputHash");
CREATE INDEX "ScheduleAdvice_userId_status_generatedAt_idx" ON "ScheduleAdvice"("userId", "status", "generatedAt");
CREATE INDEX "Narration_userId_status_generatedAt_idx" ON "Narration"("userId", "status", "generatedAt");
CREATE UNIQUE INDEX "Narration_analysisSnapshotId_key" ON "Narration"("analysisSnapshotId");
CREATE UNIQUE INDEX "Narration_scheduleAdviceId_key" ON "Narration"("scheduleAdviceId");
CREATE UNIQUE INDEX "RoutineCompletion_userId_localDate_routineRevisionKey_stepKey_key" ON "RoutineCompletion"("userId", "localDate", "routineRevisionKey", "stepKey");
CREATE INDEX "RoutineCompletion_userId_localDate_idx" ON "RoutineCompletion"("userId", "localDate");
CREATE INDEX "CareToolSession_userId_localDate_toolKey_idx" ON "CareToolSession"("userId", "localDate", "toolKey");
CREATE INDEX "CareToolSession_userId_completedAt_idx" ON "CareToolSession"("userId", "completedAt");
CREATE UNIQUE INDEX "PlanRevision_sourceAdviceId_key" ON "PlanRevision"("sourceAdviceId");
CREATE UNIQUE INDEX "PlanRevision_sourceAdviceId_userId_key" ON "PlanRevision"("sourceAdviceId", "userId");
CREATE INDEX "PlanRevision_userId_planId_createdAt_idx" ON "PlanRevision"("userId", "planId", "createdAt");
