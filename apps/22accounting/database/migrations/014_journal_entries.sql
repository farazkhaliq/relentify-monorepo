-- Migration 014: Journal Entries (double-entry bookkeeping)
-- Every financial transaction posts a balanced entry: SUM(debit) = SUM(credit)

CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  entry_date  DATE NOT NULL,
  reference   TEXT,         -- e.g. "INV-2024-0001", "BILL-0042"
  description TEXT,
  source_type TEXT,         -- invoice | bill | expense | mileage | payment | manual
  source_id   TEXT,         -- UUID of the source record
  is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_je_entity_date  ON journal_entries(entity_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_je_source       ON journal_entries(source_type, source_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES chart_of_accounts(id),
  description TEXT,
  debit       DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit      DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- each line is exclusively debit OR credit (never both non-zero)
  CHECK (debit = 0 OR credit = 0)
);

CREATE INDEX IF NOT EXISTS idx_jl_entry   ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_id);
