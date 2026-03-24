-- 012_purchase_orders.sql
-- Purchase order approvals system

CREATE TABLE po_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_threshold NUMERIC(15,2) NOT NULL DEFAULT 500.00,
  variance_tolerance_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  po_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  description TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
  -- status values: pending_approval | approved | rejected | fulfilled | fulfilled_with_variance | cancelled
  requested_by_id UUID NOT NULL REFERENCES users(id),
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approval_token UUID DEFAULT gen_random_uuid(),
  approval_token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  expected_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_order INT NOT NULL DEFAULT 0
);

-- Link bills back to the PO that authorised the spend
ALTER TABLE bills
  ADD COLUMN po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN po_variance_reason TEXT;

CREATE SEQUENCE po_number_seq START 1;

CREATE INDEX idx_po_entity_id ON purchase_orders(entity_id);
CREATE INDEX idx_po_user_id ON purchase_orders(user_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_approval_token ON purchase_orders(approval_token);
CREATE INDEX idx_po_items_po_id ON po_items(po_id);
