-- Migration 013: Chart of Accounts
-- UK nominal ledger structure based on Xero ranges:
-- 1000-1999 Assets | 2000-2999 Liabilities | 3000-3999 Equity
-- 4000-4999 Income | 5000-6999 COGS | 7000-9998 Expenses | 9999 Suspense

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  code         INTEGER NOT NULL CHECK (code BETWEEN 1000 AND 9999),
  name         TEXT NOT NULL,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','INCOME','COGS','EXPENSE','SUSPENSE')),
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,  -- system accounts cannot be deleted or deactivated
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coa_entity_type ON chart_of_accounts(entity_id, account_type);
CREATE INDEX IF NOT EXISTS idx_coa_entity_code ON chart_of_accounts(entity_id, code);
