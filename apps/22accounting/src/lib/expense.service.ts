import * as Sentry from '@sentry/nextjs';
import { query } from './db';
import {
  postJournalEntry,
  buildExpenseLines,
  buildMileageLines,
} from './general_ledger.service';
import { getAccountByCode } from './chart_of_accounts.service';

// Fallback: category string → nominal code
const EXPENSE_CATEGORY_TO_CODE: Record<string, number> = {
  advertising:   7100,
  entertainment: 7200,
  equipment:     1700,
  general:       7900,
  insurance:     8000,
  it_software:   7500,
  marketing:     7100,
  office:        7400,
  professional:  7600,
  rent:          8100,
  repairs:       8200,
  subscriptions: 8300,
  travel:        7300,
  utilities:     8400,
};

export interface Expense {
  id: string;
  user_id: string;
  date: string;
  description: string;
  category: string;
  gross_amount: string;
  vat_amount: string;
  status: 'pending' | 'reimbursed';
  notes: string | null;
  created_at: string;
}

export interface MileageClaim {
  id: string;
  user_id: string;
  date: string;
  description: string;
  from_location: string | null;
  to_location: string | null;
  miles: string;
  rate: string;
  amount: string;
  created_at: string;
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const r = await query(
    `SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
    [userId]
  );
  return r.rows as Expense[];
}

export async function createExpense(userId: string, data: {
  entityId?: string;
  date: string;
  description: string;
  category?: string;
  coaAccountId?: string;
  grossAmount: number;
  vatAmount?: number;
  notes?: string;
  skipGL?: boolean; // Set true when approval is required (GL posts on approval instead)
}) {
  const r = await query(
    `INSERT INTO expenses (user_id, date, description, category, coa_account_id, gross_amount, vat_amount, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      userId,
      data.date,
      data.description,
      data.category || 'general',
      data.coaAccountId || null,
      data.grossAmount,
      data.vatAmount ?? 0,
      data.notes || null,
    ]
  );
  const expense = r.rows[0] as Expense;

  // Post GL: Dr Expense / Cr Employee Reimbursements Payable (2110)
  // Skipped when approval is required (GL posts on approval instead)
  if (data.entityId && !data.skipGL) {
    try {
      let expenseAccountId = data.coaAccountId;
      if (!expenseAccountId) {
        const code = EXPENSE_CATEGORY_TO_CODE[data.category || ''] || 7900;
        const acct = await getAccountByCode(data.entityId, code);
        expenseAccountId = acct?.id;
      }
      if (expenseAccountId) {
        const glLines = await buildExpenseLines(data.entityId, data.grossAmount, expenseAccountId);
        await postJournalEntry({
          entityId:    data.entityId,
          userId,
          date:        data.date,
          description: `Expense: ${data.description}`,
          sourceType:  'expense',
          sourceId:    expense.id,
          lines:       glLines,
        });
      }
    } catch (_glErr) {
      console.error('[GL] Failed to post expense entry:', _glErr);
      Sentry.captureException(_glErr, { tags: { gl_operation: 'expense_creation' } });
    }
  }

  return expense;
}

export async function markExpenseReimbursed(userId: string, id: string) {
  const r = await query(
    `UPDATE expenses SET status = 'reimbursed' WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  return r.rows[0] as Expense || null;
}

export async function deleteExpense(userId: string, id: string) {
  await query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export async function getMileageClaims(userId: string): Promise<MileageClaim[]> {
  const r = await query(
    `SELECT * FROM mileage_claims WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
    [userId]
  );
  return r.rows as MileageClaim[];
}

export async function createMileageClaim(userId: string, data: {
  entityId?: string;
  date: string;
  description: string;
  fromLocation?: string;
  toLocation?: string;
  miles: number;
  rate?: number;
  coaAccountId?: string;
  skipGL?: boolean;
}) {
  const rate = data.rate ?? 0.45;
  const amount = Math.round(data.miles * rate * 100) / 100;
  const r = await query(
    `INSERT INTO mileage_claims (user_id, date, description, from_location, to_location, miles, rate, amount, coa_account_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [userId, data.date, data.description, data.fromLocation || null, data.toLocation || null, data.miles, rate, amount, data.coaAccountId || null]
  );
  const claim = r.rows[0] as MileageClaim;

  // Post GL: Dr Motor Expenses & Mileage (7304 default) / Cr Employee Reimbursements Payable (2110)
  // Skipped when approval is required (GL posts on approval instead)
  if (data.entityId && !data.skipGL) {
    try {
      const glLines = await buildMileageLines(data.entityId, amount, data.coaAccountId);
      await postJournalEntry({
        entityId:    data.entityId,
        userId,
        date:        data.date,
        description: `Mileage: ${data.description}`,
        sourceType:  'mileage',
        sourceId:    claim.id,
        lines:       glLines,
      });
    } catch (_glErr) {
      console.error('[GL] Failed to post mileage entry:', _glErr);
      Sentry.captureException(_glErr, { tags: { gl_operation: 'mileage_creation' } });
    }
  }

  return claim;
}

export async function deleteMileageClaim(userId: string, id: string) {
  await query(`DELETE FROM mileage_claims WHERE id = $1 AND user_id = $2`, [id, userId]);
}
