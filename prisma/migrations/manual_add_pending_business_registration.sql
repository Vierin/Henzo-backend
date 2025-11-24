-- CreateTable
CREATE TABLE IF NOT EXISTS "PendingBusinessRegistration" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingBusinessRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PendingBusinessRegistration_token_key" ON "PendingBusinessRegistration"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingBusinessRegistration_email_idx" ON "PendingBusinessRegistration"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingBusinessRegistration_expiresAt_idx" ON "PendingBusinessRegistration"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingBusinessRegistration_token_idx" ON "PendingBusinessRegistration"("token");


