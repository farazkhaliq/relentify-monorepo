-- 011_suppliers.sql
-- Supplier contacts directory (mirrors acc_customers, used for bill referencing)

CREATE TABLE acc_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_user_id ON acc_suppliers(user_id);
CREATE INDEX idx_suppliers_entity_id ON acc_suppliers(entity_id);
