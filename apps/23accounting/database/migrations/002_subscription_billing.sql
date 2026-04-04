-- Migration 002: subscription billing
-- Adds stripe_subscription_id, fixes tier names to match tiers.ts

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Fix constraint: free→invoicing, medium→medium_business
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_plan_check;
UPDATE users SET subscription_plan='invoicing' WHERE subscription_plan='free';
UPDATE users SET subscription_plan='medium_business' WHERE subscription_plan='medium';
ALTER TABLE users ALTER COLUMN subscription_plan SET DEFAULT 'invoicing';
ALTER TABLE users ADD CONSTRAINT users_subscription_plan_check
  CHECK (subscription_plan IN ('invoicing','sole_trader','small_business','medium_business','corporate'));
