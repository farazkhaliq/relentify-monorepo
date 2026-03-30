-- 026_migration_runs.sql
-- Run: docker exec -i infra-postgres psql -U relentify_user -d relentify < database/migrations/026_migration_runs.sql

CREATE TABLE IF NOT EXISTS migration_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID NOT NULL REFERENCES entities(id),
  user_id             UUID NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('xero', 'quickbooks')),
  cutoff_date         DATE NOT NULL,
  files_uploaded      JSONB NOT NULL DEFAULT '[]',
  auto_mappings       JSONB NOT NULL DEFAULT '[]',
  validation_warnings JSONB,
  batches             JSONB NOT NULL DEFAULT '[]',
  import_report       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_runs_entity ON migration_runs(entity_id);
CREATE INDEX IF NOT EXISTS idx_migration_runs_user   ON migration_runs(user_id);
