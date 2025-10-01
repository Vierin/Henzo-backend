/*
  Warnings:

  - You are about to drop the column `time` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `dateTime` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."SubscriptionType" ADD VALUE 'FREEMIUM';

-- AlterTable
ALTER TABLE "public"."Booking" DROP COLUMN "time",
ADD COLUMN     "dateTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false;
