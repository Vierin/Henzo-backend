-- Add language column to PushToken table
ALTER TABLE "PushToken" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'en';

