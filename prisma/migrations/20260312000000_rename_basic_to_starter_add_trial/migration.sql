-- Create new enum with TRIAL and STARTER
CREATE TYPE "SubscriptionType_new" AS ENUM ('TRIAL', 'STARTER');

-- Drop default, then alter column to use new enum (map BASIC -> TRIAL when trial, else STARTER)
ALTER TABLE "Subscription" ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "Subscription" ALTER COLUMN "type" TYPE "SubscriptionType_new" USING (
  CASE
    WHEN "type"::text = 'BASIC' AND "trialEndDate" IS NOT NULL AND (amount IS NULL OR amount = 0) THEN 'TRIAL'::"SubscriptionType_new"
    ELSE 'STARTER'::"SubscriptionType_new"
  END
);

-- Drop old enum and rename new
DROP TYPE "SubscriptionType";
ALTER TYPE "SubscriptionType_new" RENAME TO "SubscriptionType";

-- Restore default
ALTER TABLE "Subscription" ALTER COLUMN "type" SET DEFAULT 'TRIAL';
