-- AlterTable
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Salon_latitude_longitude_idx" ON "Salon"("latitude", "longitude");

