-- 028: Mismatch flagging for PO-bill and bank-invoice amount discrepancies
CREATE TABLE IF NOT EXISTS acc_mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  source_amount DECIMAL(12,2),
  reference_amount DECIMAL(12,2),
  difference DECIMAL(12,2),
  message TEXT,
  status TEXT DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mismatches_user_status ON acc_mismatches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mismatches_entity ON acc_mismatches(entity_id);
