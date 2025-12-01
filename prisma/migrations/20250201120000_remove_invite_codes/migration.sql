-- Drop table if exists (safe migration)
DROP TABLE IF EXISTS "InviteCode" CASCADE;

-- Remove inviteCodeId column from Salon if exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Salon' 
        AND column_name = 'inviteCodeId'
    ) THEN
        ALTER TABLE "Salon" DROP COLUMN "inviteCodeId";
    END IF;
END $$;

-- Drop enum if exists and not used elsewhere
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_type 
        WHERE typname = 'InviteCodeStatus'
    ) THEN
        DROP TYPE "InviteCodeStatus" CASCADE;
    END IF;
END $$;

