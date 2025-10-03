-- AlterTable
ALTER TABLE "public"."Service" ADD COLUMN     "serviceCategoryId" INTEGER;

-- CreateTable
CREATE TABLE "public"."service_categories" (
    "id" SERIAL NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_vn" TEXT NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_name_en_key" ON "public"."service_categories"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_name_vn_key" ON "public"."service_categories"("name_vn");

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
