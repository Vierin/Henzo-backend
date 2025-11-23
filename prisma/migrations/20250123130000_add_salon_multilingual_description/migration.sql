-- AlterTable
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT,
ADD COLUMN IF NOT EXISTS "descriptionVi" TEXT,
ADD COLUMN IF NOT EXISTS "descriptionRu" TEXT;

