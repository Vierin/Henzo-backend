-- Remove description field from ServiceGroup (not used)
ALTER TABLE "public"."ServiceGroup"
  DROP COLUMN IF EXISTS "description";

-- Add translation fields to ServiceGroup
ALTER TABLE "public"."ServiceGroup"
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
  ADD COLUMN IF NOT EXISTS "nameVi" TEXT,
  ADD COLUMN IF NOT EXISTS "nameRu" TEXT;

