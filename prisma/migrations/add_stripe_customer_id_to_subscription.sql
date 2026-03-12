-- Add stripeCustomerId to Subscription for Stripe Billing Portal
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
