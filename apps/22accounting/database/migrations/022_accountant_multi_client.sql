-- 022_accountant_multi_client.sql

-- Drop old broken invite table (unused, referenced nowhere in working code)
DROP TABLE IF EXISTS accountant_invitations;

-- Remove old accountant_user_id column if present (was a different design)
ALTER TABLE users DROP COLUMN IF EXISTS accountant_user_id;

-- Add accountant-specific columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_accountant_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS referral_started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accountant_bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS accountant_sort_code         TEXT,
  ADD COLUMN IF NOT EXISTS accountant_account_number    TEXT;

-- New acc_accountant_clients table: tracks invite + access lifecycle
CREATE TABLE IF NOT EXISTS acc_accountant_clients (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id      UUID        REFERENCES users(id) ON DELETE CASCADE, -- NULL until accepted
  invite_token        TEXT        NOT NULL UNIQUE,
  invite_email        TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'active', 'revoked')),
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at         TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active accountant per client at a time
CREATE UNIQUE INDEX IF NOT EXISTS accountant_clients_one_active_per_client
  ON acc_accountant_clients (client_user_id)
  WHERE status = 'active' AND client_user_id IS NOT NULL;

-- No duplicate pending invite from same accountant to same email
CREATE UNIQUE INDEX IF NOT EXISTS accountant_clients_no_dup_pending
  ON acc_accountant_clients (accountant_user_id, invite_email)
  WHERE status = 'pending';

-- Referral earnings: one row per Stripe invoice (UNIQUE on stripe_invoice_id = idempotency)
CREATE TABLE IF NOT EXISTS acc_accountant_referral_earnings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id   TEXT        NOT NULL UNIQUE,
  gross_amount        INTEGER     NOT NULL,   -- pence
  commission_amount   INTEGER     NOT NULL,   -- pence
  currency            TEXT        NOT NULL DEFAULT 'gbp',
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at             TIMESTAMPTZ,            -- set manually by Relentify staff when commission is paid out
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add actor_id to acc_audit_log (NULL = user acted for themselves)
ALTER TABLE acc_audit_log ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id);
