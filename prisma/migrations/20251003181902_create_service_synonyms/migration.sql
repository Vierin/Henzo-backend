-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."service_synonyms" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER,
    "keyword" VARCHAR(100) NOT NULL,
    "language" VARCHAR(2) DEFAULT 'en',
    "weight" DECIMAL(3,2) DEFAULT 1.0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "service_synonyms_category_id_keyword_language_key" ON "public"."service_synonyms"("category_id", "keyword", "language");

-- AddForeignKey
ALTER TABLE "public"."service_synonyms" ADD CONSTRAINT "service_synonyms_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

