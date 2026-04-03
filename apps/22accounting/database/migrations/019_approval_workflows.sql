-- Migration 019: Approval workflows
-- Adds per-staff PO approver mappings, expense approval settings,
-- and approval status columns to acc_expenses and acc_mileage_claims.

-- Per-staff PO approver overrides (staff member -> their specific approver)
CREATE TABLE IF NOT EXISTS acc_po_approver_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, staff_user_id)
);

-- Expense/mileage approval settings per entity
CREATE TABLE IF NOT EXISTS acc_expense_approval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id)
);

-- Approval columns on acc_expenses
ALTER TABLE acc_expenses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE acc_expenses ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id);
ALTER TABLE acc_expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE acc_expenses ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE acc_expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Approval columns on acc_mileage_claims
ALTER TABLE acc_mileage_claims ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE acc_mileage_claims ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id);
ALTER TABLE acc_mileage_claims ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE acc_mileage_claims ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE acc_mileage_claims ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Escalation tracking on acc_purchase_orders (for 24h cron)
ALTER TABLE acc_purchase_orders ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- Fix: Update acc_expenses status check constraint to include approval statuses
-- (original constraint only had 'pending' and 'reimbursed')
ALTER TABLE acc_expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE acc_expenses ADD CONSTRAINT expenses_status_check
  CHECK (status = ANY (ARRAY['pending', 'pending_approval', 'approved', 'reimbursed', 'rejected']));
