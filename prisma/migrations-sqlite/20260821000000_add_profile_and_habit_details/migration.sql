-- Keep SQLite's E2E schema aligned with the production PostgreSQL migration.
-- These columns intentionally remain nullable for users created before this release.
ALTER TABLE "UserProfile" ADD COLUMN "age" INTEGER;
ALTER TABLE "UserProfile" ADD COLUMN "gender" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "heightCm" INTEGER;
ALTER TABLE "UserProfile" ADD COLUMN "weightKg" REAL;

ALTER TABLE "UserHabit" ADD COLUMN "alcohol" TEXT;
