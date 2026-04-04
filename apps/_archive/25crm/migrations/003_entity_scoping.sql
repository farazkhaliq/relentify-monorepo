-- Migration 003: Standardise entity scoping
-- Adds entity_id to tables that only had user_id

-- Step 1: Add nullable entity_id columns
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE crm_properties ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE crm_tenancies ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE crm_notifications ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Step 2: Backfill entity_id from user's first entity
UPDATE crm_contacts c
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = c.user_id LIMIT 1)
WHERE c.entity_id IS NULL;

UPDATE crm_properties p
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = p.user_id LIMIT 1)
WHERE p.entity_id IS NULL;

UPDATE crm_tenancies t
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = t.user_id LIMIT 1)
WHERE t.entity_id IS NULL;

UPDATE crm_notifications n
SET entity_id = (SELECT e.id FROM entities e WHERE e.user_id = n.user_id LIMIT 1)
WHERE n.entity_id IS NULL;

-- Step 3: Add NOT NULL constraint where possible + indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM crm_contacts WHERE entity_id IS NULL LIMIT 1) THEN
    ALTER TABLE crm_contacts ALTER COLUMN entity_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_properties WHERE entity_id IS NULL LIMIT 1) THEN
    ALTER TABLE crm_properties ALTER COLUMN entity_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_tenancies WHERE entity_id IS NULL LIMIT 1) THEN
    ALTER TABLE crm_tenancies ALTER COLUMN entity_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_entity ON crm_contacts(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_properties_entity ON crm_properties(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_tenancies_entity ON crm_tenancies(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_entity ON crm_notifications(entity_id);
