-- Migration 015: Link transactions to Chart of Accounts
-- Adds coa_account_id FK to bills, expenses, mileage.
-- The existing 'category' text column is kept for backward compat / display.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS coa_account_id UUID REFERENCES chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS invoice_date   DATE;  -- purchase invoice date (separate from due date)

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS coa_account_id UUID REFERENCES chart_of_accounts(id);

ALTER TABLE mileage_claims
  ADD COLUMN IF NOT EXISTS coa_account_id UUID REFERENCES chart_of_accounts(id);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_bills_coa         ON bills(coa_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_coa      ON expenses(coa_account_id);
CREATE INDEX IF NOT EXISTS idx_mileage_claims_coa ON mileage_claims(coa_account_id);
