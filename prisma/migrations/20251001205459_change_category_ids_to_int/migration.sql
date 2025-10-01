/*
  Warnings:

  - The `categoryIds` column on the `Salon` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."Salon" DROP COLUMN "categoryIds",
ADD COLUMN     "categoryIds" INTEGER[];
