-- 025_accounting_engine.sql
-- Run: docker exec -i infra-postgres psql -U relentify_user -d relentify < database/migrations/025_accounting_engine.sql

-- ────────────────────────────────────────────────
-- 1. UNIQUE constraint on acc_journal_entries (source deduplication)
-- ────────────────────────────────────────────────

-- First remove any existing duplicates (keep newest row per group)
DELETE FROM acc_journal_entries je
WHERE source_id IS NOT NULL
  AND je.id NOT IN (
    SELECT DISTINCT ON (entity_id, source_type, source_id) id
    FROM acc_journal_entries
    WHERE source_id IS NOT NULL
    ORDER BY entity_id, source_type, source_id, created_at DESC
  );

ALTER TABLE acc_journal_entries
  ADD CONSTRAINT uq_journal_entry_source
  UNIQUE (entity_id, source_type, source_id);

-- ────────────────────────────────────────────────
-- 2. Idempotency keys table
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acc_idempotency_keys (
  key        TEXT PRIMARY KEY,
  entity_id  UUID NOT NULL,
  response   JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idempotency_entity_date
  ON acc_idempotency_keys(entity_id, created_at);

-- ────────────────────────────────────────────────
-- 3. Journal entry: status + accrual fields + immutability
-- ────────────────────────────────────────────────

ALTER TABLE acc_journal_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft', 'posted')),
  ADD COLUMN IF NOT EXISTS is_accrual   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reversal_date DATE,
  ADD COLUMN IF NOT EXISTS reversed_by  UUID REFERENCES acc_journal_entries(id);

-- Back-fill: all existing entries are posted
UPDATE acc_journal_entries SET status = 'posted' WHERE status IS NULL;

-- ────────────────────────────────────────────────
-- 4. Prepayment flag on bill payments
-- ────────────────────────────────────────────────

ALTER TABLE acc_bank_transactions
  ADD COLUMN IF NOT EXISTS is_prepayment       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prepayment_months   INTEGER,
  ADD COLUMN IF NOT EXISTS prepayment_exp_acct UUID REFERENCES acc_chart_of_accounts(id);

-- ────────────────────────────────────────────────
-- 5. Control accounts on acc_chart_of_accounts
-- ────────────────────────────────────────────────

ALTER TABLE acc_chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_control_account BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS control_type       TEXT
    CHECK (control_type IN ('AR', 'AP', NULL));

-- Mark existing AR/AP accounts across all entities
UPDATE acc_chart_of_accounts SET is_control_account = TRUE, control_type = 'AR'
  WHERE code = 1100;
UPDATE acc_chart_of_accounts SET is_control_account = TRUE, control_type = 'AP'
  WHERE code = 2100;

-- Seed Prepayments account (1300) if missing, per entity
INSERT INTO acc_chart_of_accounts (entity_id, code, name, account_type, is_system)
SELECT e.id, 1300, 'Prepayments', 'ASSET', TRUE
FROM entities e
WHERE NOT EXISTS (
  SELECT 1 FROM acc_chart_of_accounts WHERE entity_id = e.id AND code = 1300
);

-- ────────────────────────────────────────────────
-- 6. Audit log: add missing columns
-- ────────────────────────────────────────────────

ALTER TABLE acc_audit_log
  ADD COLUMN IF NOT EXISTS actor_id            UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS workspace_entity_id UUID REFERENCES entities(id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON acc_audit_log(workspace_entity_id, created_at DESC);

-- ────────────────────────────────────────────────
-- 7. Cron runs table
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acc_cron_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  error             TEXT,
  records_processed INTEGER
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job
  ON acc_cron_runs(job_name, started_at DESC);

-- ────────────────────────────────────────────────
-- 8. Team member roles (acc_workspace_members table — that is the actual table name)
-- ────────────────────────────────────────────────

ALTER TABLE acc_workspace_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('admin', 'accountant', 'staff'));

-- ────────────────────────────────────────────────
-- 9. Performance indexes
-- ────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_lines_entry_acct
  ON acc_journal_lines(entry_id) INCLUDE (account_id, debit, credit);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_lines_account_entry
  ON acc_journal_lines(account_id, entry_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_entity_status
  ON acc_invoices(entity_id, status, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_entity_status
  ON acc_bills(entity_id, status, due_date);
