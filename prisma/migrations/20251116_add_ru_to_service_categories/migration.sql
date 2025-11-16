ALTER TABLE "public"."service_categories"
  ADD COLUMN IF NOT EXISTS "name_ru" TEXT NOT NULL DEFAULT '';

-- backfill: if empty, copy from name_en to avoid blanks
UPDATE "public"."service_categories"
SET "name_ru" = CASE
  WHEN COALESCE("name_ru", '') = '' THEN "name_en"
  ELSE "name_ru"
END;

-- unique and trigram index for RU name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'service_categories_name_ru_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX service_categories_name_ru_key ON "public"."service_categories"("name_ru")';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_service_categories_name_ru_trgm ON service_categories USING GIN (name_ru gin_trgm_ops);


