-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."RecommendedService" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "categoryId" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendedService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecommendedService_nameEn_nameVi_nameRu_idx" ON "public"."RecommendedService"("nameEn", "nameVi", "nameRu");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecommendedService_priority_idx" ON "public"."RecommendedService"("priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecommendedService_categoryId_idx" ON "public"."RecommendedService"("categoryId");

