-- CreateEnum
CREATE TYPE "SalonStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE');

-- AlterTable
ALTER TABLE "Salon" ADD COLUMN "status" "SalonStatus" NOT NULL DEFAULT 'DRAFT';

