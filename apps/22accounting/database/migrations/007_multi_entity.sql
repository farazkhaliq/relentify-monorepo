-- 007_multi_entity.sql
-- Multi-entity support: each user can manage multiple legal entities

-- 1. Entities table
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  business_structure VARCHAR(50),
  company_number VARCHAR(50),
  vat_registered BOOLEAN DEFAULT FALSE,
  vat_number VARCHAR(50),
  currency VARCHAR(3) DEFAULT 'GBP',
  country_code VARCHAR(2) DEFAULT 'GB',
  address TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  hmrc_access_token TEXT,
  hmrc_refresh_token TEXT,
  hmrc_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_user_id ON entities(user_id);

-- 2. Add entity_id to data tables (nullable first, set NOT NULL after backfill)
ALTER TABLE invoices ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE customers ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE bills ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE bank_transactions ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE bank_connections ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id);

-- 3. Add active_entity_id to users
ALTER TABLE users ADD COLUMN active_entity_id UUID REFERENCES entities(id);

-- 4. Seed default entity per existing user
INSERT INTO entities (id, user_id, name, business_structure, company_number, vat_registered, vat_number, is_default)
SELECT
  gen_random_uuid(),
  id,
  COALESCE(NULLIF(business_name, ''), full_name),
  business_structure,
  company_number,
  COALESCE(vat_registered, FALSE),
  vat_number,
  TRUE
FROM users;

-- 5. Set active_entity_id on users
UPDATE users u SET active_entity_id = e.id
FROM entities e WHERE e.user_id = u.id AND e.is_default = TRUE;

-- 6. Backfill entity_id on all data tables from the default entity
UPDATE invoices i SET entity_id = e.id
FROM entities e WHERE e.user_id = i.user_id AND e.is_default = TRUE;

UPDATE customers c SET entity_id = e.id
FROM entities e WHERE e.user_id = c.user_id AND e.is_default = TRUE;

UPDATE bills b SET entity_id = e.id
FROM entities e WHERE e.user_id = b.user_id AND e.is_default = TRUE;

UPDATE bank_transactions bt SET entity_id = e.id
FROM entities e WHERE e.user_id = bt.user_id AND e.is_default = TRUE;

UPDATE bank_connections bc SET entity_id = e.id
FROM entities e WHERE e.user_id = bc.user_id AND e.is_default = TRUE;

UPDATE audit_log al SET entity_id = e.id
FROM entities e WHERE e.user_id = al.user_id AND e.is_default = TRUE;

-- 7. Make entity_id NOT NULL after backfill (audit_log stays nullable)
ALTER TABLE invoices ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE bills ALTER COLUMN entity_id SET NOT NULL;

-- 8. Intercompany links table
CREATE TABLE intercompany_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiating_entity_id UUID NOT NULL REFERENCES entities(id),
  receiving_entity_id UUID NOT NULL REFERENCES entities(id),
  source_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  mirror_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
