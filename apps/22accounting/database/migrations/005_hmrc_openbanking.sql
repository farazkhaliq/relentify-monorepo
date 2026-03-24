-- HMRC MTD OAuth tokens on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS hmrc_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hmrc_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hmrc_token_expires_at TIMESTAMPTZ;

-- VAT on bills (input VAT for Box 4/7)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Open Banking connections (TrueLayer)
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'truelayer',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  truelayer_account_id TEXT,
  display_name TEXT,
  account_type TEXT,
  currency TEXT DEFAULT 'GBP',
  balance NUMERIC(12,2),
  balance_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_connections_user ON bank_connections(user_id);
