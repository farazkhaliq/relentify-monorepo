import { query, withTransaction } from './db';
import { postJournalEntry, buildExpenseLines, buildMileageLines } from './general_ledger.service';
import { getAccountByCode } from './chart_of_accounts.service';
import { dispatchWebhookEvent } from './webhook.service';

const EXPENSE_CATEGORY_TO_CODE: Record<string, number> = {
  advertising: 7100, entertainment: 7200, equipment: 1700, general: 7900,
  insurance: 8000, it_software: 7500, marketing: 7100, office: 7400,
  professional: 7600, rent: 8100, repairs: 8200, subscriptions: 8300,
  travel: 7300, utilities: 8400,
};

export interface ExpenseApprovalSettings {
  id: string;
  entity_id: string;
  enabled: boolean;
  approver_user_id: string | null;
  approver_name?: string;
  approver_email?: string;
}

export async function getExpenseApprovalSettings(entityId: string): Promise<ExpenseApprovalSettings | null> {
  const r = await query(
    `SELECT eas.*, u.full_name AS approver_name, u.email AS approver_email
     FROM acc_expense_approval_settings eas
     LEFT JOIN users u ON eas.approver_user_id = u.id
     WHERE eas.entity_id = $1`,
    [entityId]
  );
  return r.rows[0] || null;
}

export async function upsertExpenseApprovalSettings(
  entityId: string,
  data: { enabled: boolean; approverUserId?: string | null }
): Promise<ExpenseApprovalSettings> {
  const r = await query(
    `INSERT INTO acc_expense_approval_settings (entity_id, enabled, approver_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       approver_user_id = EXCLUDED.approver_user_id,
       updated_at = NOW()
     RETURNING *`,
    [entityId, data.enabled, data.approverUserId || null]
  );
  return r.rows[0] as ExpenseApprovalSettings;
}

export async function approveExpense(
  expenseId: string,
  approverId: string,
  entityId: string
): Promise<boolean> {
  const approved = await withTransaction(async (client) => {
    const r = await client.query(
      `UPDATE acc_expenses SET
         status = 'approved',
         approved_by_id = $2,
         approved_at = NOW()
       WHERE id = $1 AND status = 'pending_approval'
       RETURNING *`,
      [expenseId, approverId]
    );
    const expense = r.rows[0];
    if (!expense) return false;

    // Post GL on approval — deferred from creation when approval flow is active
    let expenseAccountId = expense.coa_account_id;
    if (!expenseAccountId) {
      const code = EXPENSE_CATEGORY_TO_CODE[expense.category || ''] || 7900;
      const acct = await getAccountByCode(entityId, code);
      expenseAccountId = acct?.id;
    }
    if (!expenseAccountId) throw new Error('Could not resolve expense account for GL entry');

    const glLines = await buildExpenseLines(entityId, parseFloat(expense.gross_amount), expenseAccountId);
    await postJournalEntry({
      entityId,
      userId:      approverId,
      date:        expense.date,
      description: `Expense approved: ${expense.description}`,
      sourceType:  'expense',
      sourceId:    expenseId,
      lines:       glLines,
    }, client);

    return true;
  });

  if (approved) {
    dispatchWebhookEvent(entityId, 'expense.approved', { expense: { id: expenseId } }).catch(() => {});
  }

  return approved;
}

export async function rejectExpense(
  expenseId: string,
  approverId: string,
  reason: string
): Promise<boolean> {
  const r = await query(
    `UPDATE acc_expenses SET
       status = 'rejected',
       approved_by_id = $2,
       rejected_at = NOW(),
       rejection_reason = $3
     WHERE id = $1 AND status = 'pending_approval'
     RETURNING *`,
    [expenseId, approverId, reason]
  );
  return !!r.rows[0];
}

export async function approveMileage(
  claimId: string,
  approverId: string,
  entityId: string
): Promise<boolean> {
  return withTransaction(async (client) => {
    const r = await client.query(
      `UPDATE acc_mileage_claims SET
         status = 'approved',
         approved_by_id = $2,
         approved_at = NOW()
       WHERE id = $1 AND status = 'pending_approval'
       RETURNING *`,
      [claimId, approverId]
    );
    const claim = r.rows[0];
    if (!claim) return false;

    // Post GL on approval — deferred from creation
    const glLines = await buildMileageLines(entityId, parseFloat(claim.amount), claim.coa_account_id);
    await postJournalEntry({
      entityId,
      userId:      approverId,
      date:        claim.date,
      description: `Mileage approved: ${claim.description}`,
      sourceType:  'mileage',
      sourceId:    claimId,
      lines:       glLines,
    }, client);

    return true;
  });
}

export async function rejectMileage(
  claimId: string,
  approverId: string,
  reason: string
): Promise<boolean> {
  const r = await query(
    `UPDATE acc_mileage_claims SET
       status = 'rejected',
       approved_by_id = $2,
       rejected_at = NOW(),
       rejection_reason = $3
     WHERE id = $1 AND status = 'pending_approval'
     RETURNING *`,
    [claimId, approverId, reason]
  );
  return !!r.rows[0];
}

/**
 * Get all pending approval items for an entity (for the approver's dashboard panel).
 * Scoped to users who are members of the entity via workspace_users.
 */
export async function getPendingApprovals(entityId: string): Promise<{
  expenses: any[];
  mileage: any[];
}> {
  const [expenses, mileage] = await Promise.all([
    query(
      `SELECT e.*, u.full_name AS claimant_name, u.email AS claimant_email
       FROM acc_expenses e
       JOIN users u ON e.user_id = u.id
       WHERE e.status = 'pending_approval'
         AND e.user_id IN (
           SELECT user_id FROM workspace_users WHERE entity_id = $1
           UNION
           SELECT $1::uuid::text::uuid  -- include the entity owner
         )
       ORDER BY e.created_at ASC`,
      [entityId]
    ).catch(() => query(
      // Fallback: return all pending if workspace_users doesn't exist
      `SELECT e.*, u.full_name AS claimant_name, u.email AS claimant_email
       FROM acc_expenses e
       JOIN users u ON e.user_id = u.id
       WHERE e.status = 'pending_approval'
       ORDER BY e.created_at ASC`,
      []
    )),
    query(
      `SELECT mc.*, u.full_name AS claimant_name, u.email AS claimant_email
       FROM acc_mileage_claims mc
       JOIN users u ON mc.user_id = u.id
       WHERE mc.status = 'pending_approval'
         AND mc.user_id IN (
           SELECT user_id FROM workspace_users WHERE entity_id = $1
           UNION
           SELECT $1::uuid::text::uuid
         )
       ORDER BY mc.created_at ASC`,
      [entityId]
    ).catch(() => query(
      `SELECT mc.*, u.full_name AS claimant_name, u.email AS claimant_email
       FROM acc_mileage_claims mc
       JOIN users u ON mc.user_id = u.id
       WHERE mc.status = 'pending_approval'
       ORDER BY mc.created_at ASC`,
      []
    )),
  ]);

  return {
    expenses: expenses.rows,
    mileage: mileage.rows,
  };
}
