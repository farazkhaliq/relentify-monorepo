-- 008_projects.sql
-- Project/job costing: tag acc_invoices and acc_bills to named acc_projects

CREATE TABLE acc_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES acc_customers(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  budget NUMERIC(15,2),
  currency VARCHAR(3) DEFAULT 'GBP',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_entity_id ON acc_projects(entity_id);
CREATE INDEX idx_projects_user_id ON acc_projects(user_id);

ALTER TABLE acc_invoices ADD COLUMN project_id UUID REFERENCES acc_projects(id) ON DELETE SET NULL;
ALTER TABLE acc_bills ADD COLUMN project_id UUID REFERENCES acc_projects(id) ON DELETE SET NULL;
