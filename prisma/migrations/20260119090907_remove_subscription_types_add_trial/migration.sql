/*
  Warnings:

  - The values [ENTERPRISE, FREEMIUM] on the enum `SubscriptionType` will be removed. If these variants are still used in the database, this will fail.
  - Added the optional column `trialEndDate` to the `Subscription` table.

*/
-- Step 1: Update all subscriptions to BASIC type
UPDATE "public"."Subscription" SET "type" = 'BASIC' WHERE "type" IN ('ENTERPRISE', 'FREEMIUM');

-- Step 2: Add trialEndDate column
ALTER TABLE "public"."Subscription" ADD COLUMN "trialEndDate" TIMESTAMP(3);

-- Step 3: Create new enum with only BASIC
BEGIN;
CREATE TYPE "public"."SubscriptionType_new" AS ENUM ('BASIC');
ALTER TABLE "public"."Subscription" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "public"."Subscription" ALTER COLUMN "type" TYPE "public"."SubscriptionType_new" USING ("type"::text::"public"."SubscriptionType_new");
ALTER TYPE "public"."SubscriptionType" RENAME TO "SubscriptionType_old";
ALTER TYPE "public"."SubscriptionType_new" RENAME TO "SubscriptionType";
DROP TYPE "public"."SubscriptionType_old";
ALTER TABLE "public"."Subscription" ALTER COLUMN "type" SET DEFAULT 'BASIC';
COMMIT;

