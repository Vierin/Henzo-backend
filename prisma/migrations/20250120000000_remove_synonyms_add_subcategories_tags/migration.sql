-- Drop foreign key constraint from service_synonyms
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'service_synonyms_category_id_fkey') THEN
        ALTER TABLE "public"."service_synonyms" DROP CONSTRAINT "service_synonyms_category_id_fkey";
    END IF;
END $$;

-- Drop indexes for service_synonyms
DROP INDEX IF EXISTS "idx_service_synonyms_keyword_trgm";
DROP INDEX IF EXISTS "idx_service_synonyms_category_id";
DROP INDEX IF EXISTS "idx_service_synonyms_category";
DROP INDEX IF EXISTS "idx_service_synonyms_keyword";
DROP INDEX IF EXISTS "service_synonyms_category_id_keyword_language_key";

-- Drop service_synonyms table
DROP TABLE IF EXISTS "public"."service_synonyms";

-- Add serviceSubcategoryId column to Service table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Service' AND column_name = 'serviceSubcategoryId') THEN
        ALTER TABLE "public"."Service" ADD COLUMN "serviceSubcategoryId" INTEGER;
    END IF;
END $$;

-- Create ServiceSubcategory table
CREATE TABLE IF NOT EXISTS "public"."ServiceSubcategory" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT,
    "nameVi" TEXT,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "ServiceSubcategory_pkey" PRIMARY KEY ("id")
);

-- Create ServiceTag table
CREATE TABLE IF NOT EXISTS "public"."ServiceTag" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameRu" TEXT,
    "nameVi" TEXT,

    CONSTRAINT "ServiceTag_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on ServiceTag.nameEn
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ServiceTag_nameEn_key') THEN
        CREATE UNIQUE INDEX "ServiceTag_nameEn_key" ON "public"."ServiceTag"("nameEn");
    END IF;
END $$;

-- Create many-to-many relation table for Service and ServiceTag
CREATE TABLE IF NOT EXISTS "_ServiceTags" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- Create indexes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ServiceSubcategory_categoryId_idx') THEN
        CREATE INDEX "ServiceSubcategory_categoryId_idx" ON "public"."ServiceSubcategory"("categoryId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = '_ServiceTags_AB_unique') THEN
        CREATE UNIQUE INDEX "_ServiceTags_AB_unique" ON "_ServiceTags"("A", "B");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = '_ServiceTags_B_index') THEN
        CREATE INDEX "_ServiceTags_B_index" ON "_ServiceTags"("B");
    END IF;
END $$;

-- Add foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Service_serviceSubcategoryId_fkey') THEN
        ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_serviceSubcategoryId_fkey" FOREIGN KEY ("serviceSubcategoryId") REFERENCES "public"."ServiceSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ServiceSubcategory_categoryId_fkey') THEN
        ALTER TABLE "public"."ServiceSubcategory" ADD CONSTRAINT "ServiceSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = '_ServiceTags_A_fkey') THEN
        ALTER TABLE "_ServiceTags" ADD CONSTRAINT "_ServiceTags_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = '_ServiceTags_B_fkey') THEN
        ALTER TABLE "_ServiceTags" ADD CONSTRAINT "_ServiceTags_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."ServiceTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

