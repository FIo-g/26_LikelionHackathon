-- Keep the field nullable so saved records from before this release remain readable.
ALTER TABLE "AlcoholEntry" ADD COLUMN "measurementUnit" TEXT;
