-- Migration 004: New tables for full Firebase parity

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Communications
CREATE TABLE IF NOT EXISTS crm_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('Email', 'Call', 'WhatsApp', 'SMS', 'Note')),
  direction VARCHAR(10) CHECK (direction IN ('Inbound', 'Outbound')),
  subject VARCHAR(500),
  body TEXT,
  status VARCHAR(20) DEFAULT 'Received',
  related_property_id UUID REFERENCES crm_properties(id) ON DELETE SET NULL,
  related_tenancy_id UUID REFERENCES crm_tenancies(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_communications_entity ON crm_communications(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_communications_contact ON crm_communications(contact_id);

-- 2. Documents
CREATE TABLE IF NOT EXISTS crm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_type VARCHAR(50) NOT NULL,
  related_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_documents_entity ON crm_documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_related ON crm_documents(related_type, related_id);

-- 3. Transactions
CREATE TABLE IF NOT EXISTS crm_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  tenancy_id UUID REFERENCES crm_tenancies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  related_property_id UUID REFERENCES crm_properties(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('Rent Payment', 'Management Fee', 'Commission', 'Landlord Payout', 'Contractor Payment', 'Agency Expense', 'Deposit')),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Failed', 'Cancelled')),
  reconciled BOOLEAN DEFAULT false,
  description TEXT,
  payer_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  payee_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_entity ON crm_transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_transactions_tenancy ON crm_transactions(tenancy_id);

-- 4. Workflow Rules
CREATE TABLE IF NOT EXISTS crm_workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_workflow_rules_entity ON crm_workflow_rules(entity_id);

-- 5. Bank Accounts
CREATE TABLE IF NOT EXISTS crm_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  sort_code VARCHAR(10),
  account_number VARCHAR(20),
  bank_name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_bank_accounts_entity ON crm_bank_accounts(entity_id);

-- 6. Audit Logs (append-only)
CREATE TABLE IF NOT EXISTS crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('Create', 'Update', 'Delete', 'Login', 'Logout')),
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  resource_name VARCHAR(255),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_entity ON crm_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_created ON crm_audit_logs(created_at DESC);

-- 7. User Profiles
CREATE TABLE IF NOT EXISTS crm_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_user_profiles_entity ON crm_user_profiles(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_user_profiles_user ON crm_user_profiles(user_id);

-- 8. Portal Users
CREATE TABLE IF NOT EXISTS crm_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('Tenant', 'Landlord')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_portal_users_entity ON crm_portal_users(entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_portal_users_email ON crm_portal_users(email);

-- Add update triggers (skip for audit_logs — append only)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['crm_communications', 'crm_documents', 'crm_transactions', 'crm_workflow_rules', 'crm_bank_accounts', 'crm_user_profiles', 'crm_portal_users']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_' || tbl || '_updated_at') THEN
      EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tbl, tbl);
    END IF;
  END LOOP;
END $$;
