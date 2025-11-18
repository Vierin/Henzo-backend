-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Services
CREATE INDEX IF NOT EXISTS idx_service_name_trgm ON "Service" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_description_trgm ON "Service" USING GIN ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_serviceCategoryId ON "Service" ("serviceCategoryId");

-- Service Synonyms (table should be created in previous migration)
-- Only create indexes if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_synonyms') THEN
        CREATE INDEX IF NOT EXISTS idx_service_synonyms_keyword_trgm ON service_synonyms USING GIN (keyword gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_service_synonyms_category_id ON service_synonyms (category_id);
        CREATE INDEX IF NOT EXISTS idx_service_synonyms_language ON service_synonyms (language);
    END IF;
END $$;

-- Service Categories
CREATE INDEX IF NOT EXISTS idx_service_categories_name_en_trgm ON service_categories USING GIN (name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_categories_name_vn_trgm ON service_categories USING GIN (name_vn gin_trgm_ops);

-- Salons
CREATE INDEX IF NOT EXISTS idx_salon_name_trgm ON "Salon" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_salon_address_trgm ON "Salon" USING GIN ("address" gin_trgm_ops);


