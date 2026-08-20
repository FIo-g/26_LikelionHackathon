-- Additive nullable columns keep existing production accounts valid while
-- onboarding and account settings begin collecting the expanded Figma fields.
ALTER TABLE "UserProfile"
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "heightCm" INTEGER,
  ADD COLUMN "weightKg" DOUBLE PRECISION;

ALTER TABLE "UserHabit"
  ADD COLUMN "alcohol" TEXT;
