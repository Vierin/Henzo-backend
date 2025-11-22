-- CreateEnum for TimeBlockType
DO $$ BEGIN
 CREATE TYPE "TimeBlockType" AS ENUM ('TIME_OFF', 'BUSY', 'CLOSURE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum for ConflictAction
DO $$ BEGIN
 CREATE TYPE "ConflictAction" AS ENUM ('KEEP', 'CANCEL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable TimeBlock
CREATE TABLE IF NOT EXISTS "TimeBlock" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "staffId" TEXT,
    "type" "TimeBlockType" NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "conflictAction" "ConflictAction" NOT NULL DEFAULT 'KEEP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimeBlock_salonId_idx" ON "TimeBlock"("salonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimeBlock_staffId_idx" ON "TimeBlock"("staffId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimeBlock_startDate_endDate_idx" ON "TimeBlock"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_staffId_fkey" 
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Success message
SELECT 'TimeBlock table created successfully!' as message;











