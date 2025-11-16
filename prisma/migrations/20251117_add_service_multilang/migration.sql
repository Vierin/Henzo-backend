ALTER TABLE "public"."Service"
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
  ADD COLUMN IF NOT EXISTS "nameVi" TEXT,
  ADD COLUMN IF NOT EXISTS "nameRu" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionVi" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionRu" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceGroupId" TEXT;

CREATE TABLE IF NOT EXISTS "public"."ServiceGroup" (
  "id" TEXT PRIMARY KEY,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE "public"."Service"
  ADD CONSTRAINT "Service_serviceGroupId_fkey"
  FOREIGN KEY ("serviceGroupId") REFERENCES "public"."ServiceGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_servicegroup_salon_position"
ON "public"."ServiceGroup"("salonId", "position");


