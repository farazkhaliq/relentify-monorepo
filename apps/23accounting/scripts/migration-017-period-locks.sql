-- Migration 017: Period locks

-- Add lock boundary to entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS locked_through_date DATE NULL;

-- Audit trail of every lock boundary change
CREATE TABLE IF NOT EXISTS period_lock_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  locked_by     UUID NOT NULL REFERENCES users(id),
  lock_type     TEXT NOT NULL CHECK (lock_type IN ('vat_filing', 'manual_year_end', 'unlock')),
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  reason        TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_period_lock_events_entity ON period_lock_events(entity_id);

-- Per-user posting override (admin/accountant grants named user access to locked period)
CREATE TABLE IF NOT EXISTS period_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by      UUID NOT NULL REFERENCES users(id),
  override_until  TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_period_overrides_entity ON period_overrides(entity_id);
CREATE INDEX IF NOT EXISTS idx_period_overrides_user ON period_overrides(entity_id, user_id);
