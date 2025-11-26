-- Migration: Remove ServiceSubcategory and ServiceTag
-- This removes subcategories and tags as per new requirements

-- Step 1: Remove foreign key constraint for serviceSubcategoryId
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_serviceSubcategoryId_fkey";

-- Step 2: Remove serviceSubcategoryId column from Service table
ALTER TABLE "Service" DROP COLUMN IF EXISTS "serviceSubcategoryId";

-- Step 3: Drop ServiceSubcategory table
DROP TABLE IF EXISTS "ServiceSubcategory" CASCADE;

-- Step 4: Drop ServiceTag table (and its relation table if exists)
DROP TABLE IF EXISTS "ServiceTag" CASCADE;
DROP TABLE IF EXISTS "_ServiceTags" CASCADE;

-- Note: service_categories table remains with only 5 main categories

