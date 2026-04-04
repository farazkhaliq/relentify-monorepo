-- Migration 015: Link transactions to Chart of Accounts
-- Adds coa_account_id FK to acc_bills, acc_expenses, mileage.
-- The existing 'category' text column is kept for backward compat / display.

ALTER TABLE acc_bills
  ADD COLUMN IF NOT EXISTS coa_account_id UUID REFERENCES acc_chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS invoice_date   DATE;  -- purchase invoice date (separate from due date)

ALTER TABLE acc_expenses
  ADD COLUMN IF NOT EXISTS coa_account_id UUID REFERENCES acc_chart_of_accounts(id);

ALTER TABLE acc_mileage_claims
  ADD COLUMN IF NOT EXISTS coa_account_id UUID REFERENCES acc_chart_of_accounts(id);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_bills_coa         ON acc_bills(coa_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_coa      ON acc_expenses(coa_account_id);
CREATE INDEX IF NOT EXISTS idx_mileage_claims_coa ON acc_mileage_claims(coa_account_id);
