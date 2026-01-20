-- Step 0: Обновляем все данные до безопасного значения
UPDATE "public"."Subscription"
SET "type" = 'BASIC'
WHERE "type" IN ('ENTERPRISE', 'FREEMIUM');

-- Step 1: Добавляем новый столбец trialEndDate
ALTER TABLE "public"."Subscription"
ADD COLUMN "trialEndDate" TIMESTAMP(3);

-- Step 2: Создаем новый enum с нужными значениями
CREATE TYPE "public"."SubscriptionType_new" AS ENUM ('BASIC');

-- Step 3: Меняем колонку на новый тип
ALTER TABLE "public"."Subscription"
ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "public"."Subscription"
ALTER COLUMN "type" TYPE "public"."SubscriptionType_new"
USING ("type"::text::"public"."SubscriptionType_new");

-- Step 4: Убираем старый enum
ALTER TYPE "public"."SubscriptionType" RENAME TO "SubscriptionType_old";
ALTER TYPE "public"."SubscriptionType_new" RENAME TO "SubscriptionType";
DROP TYPE "public"."SubscriptionType_old";

-- Step 5: Восстанавливаем дефолт
ALTER TABLE "public"."Subscription"
ALTER COLUMN "type" SET DEFAULT 'BASIC';
