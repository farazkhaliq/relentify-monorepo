-- Bills table
CREATE TABLE IF NOT EXISTS acc_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  due_date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','overdue')),
  notes TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bills_user_id ON acc_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_status ON acc_bills(user_id, status);

-- Card payment toggle
ALTER TABLE users ADD COLUMN IF NOT EXISTS accept_card_payments BOOLEAN DEFAULT TRUE;
