-- 008_projects.sql
-- Project/job costing: tag invoices and bills to named projects

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  budget NUMERIC(15,2),
  currency VARCHAR(3) DEFAULT 'GBP',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_entity_id ON projects(entity_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);

ALTER TABLE invoices ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE bills ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
