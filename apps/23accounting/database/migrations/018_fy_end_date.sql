-- 018_fy_end_date.sql
-- Adds last financial year end date to entities.
-- Nullable: null = no year-end close has ever been run for this entity.
-- Updated each time year-end close is confirmed.

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS last_fy_end_date DATE;
