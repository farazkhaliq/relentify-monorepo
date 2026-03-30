import { query, withTransaction } from './db';
import {
  postJournalEntry,
  buildBillCreationLines,
  buildBillPaymentLines,
} from './general_ledger.service';
import { getAccountByCode } from './chart_of_accounts.service';

// Fallback mapping from legacy category strings → nominal codes
const CATEGORY_TO_CODE: Record<string, number> = {
  advertising:      7100,
  bank_charges:     7700,
  entertainment:    7200,
  equipment:        1700,
  general:          7900,
  insurance:        8000,
  it_software:      7500,
  marketing:        7100,
  materials:        5001,
  office:           7400,
  office_supplies:  7400,
  professional:     7600,
  rent:             8100,
  repairs:          8200,
  salaries:         7000,
  software:         7500,
  subscriptions:    8300,
  travel:           7300,
  utilities:        8400,
};

export interface Bill {
  id: string;
  user_id: string;
  supplier_name: string;
  amount: string;
  vat_rate: string;
  vat_amount: string;
  currency: string;
  due_date: string;
  category: string;
  status: string;
  notes: string | null;
  reference: string | null;
  created_at: string;
  paid_at: string | null;
}

export async function createBill(userId: string, data: {
  entityId: string;
  supplierName: string;
  supplierId?: string;
  amount: number;
  vatRate?: number;
  vatAmount?: number;
  currency?: string;
  invoiceDate?: string;
  dueDate: string;
  category?: string;
  coaAccountId?: string;
  notes?: string;
  reference?: string;
  projectId?: string;
  poId?: string;
  poVarianceReason?: string;
  skipGLPosting?: boolean; // set true during migration — GL handled by opening balances import
}) {
  return withTransaction(async (client) => {
    const r = await client.query(
      `INSERT INTO bills (user_id, entity_id, supplier_name, amount, vat_rate, vat_amount, currency, invoice_date, due_date, category, coa_account_id, notes, reference, project_id, po_id, po_variance_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        userId, data.entityId, data.supplierName, data.amount,
        data.vatRate ?? 0, data.vatAmount ?? 0, data.currency || 'GBP',
        data.invoiceDate ?? null, data.dueDate, data.category ?? 'general',
        data.coaAccountId ?? null, data.notes ?? null, data.reference ?? null,
        data.projectId ?? null, data.poId ?? null, data.poVarianceReason ?? null,
      ]
    );
    const bill = r.rows[0] as Bill;

    if (!data.skipGLPosting) {
      // Resolve expense account — must happen inside tx so failure rolls back the bill
      let expenseAccountId = data.coaAccountId;
      if (!expenseAccountId) {
        const code = CATEGORY_TO_CODE[data.category ?? ''] ?? 7900;
        const acct = await getAccountByCode(data.entityId, code);
        expenseAccountId = acct?.id;
      }
      if (!expenseAccountId) throw new Error('Could not resolve expense account for bill GL entry');

      const vatAmt = data.vatAmount ?? 0;
      const glLines = await buildBillCreationLines(data.entityId, data.amount, vatAmt, expenseAccountId);
      await postJournalEntry({
        entityId:    data.entityId,
        userId,
        date:        data.invoiceDate ?? data.dueDate,
        reference:   data.reference ?? undefined,
        description: `Bill from ${data.supplierName}`,
        sourceType:  'bill',
        sourceId:    bill.id,
        lines:       glLines,
      }, client);
    }

    return bill;
  });
}

export async function getAllBills(userId: string, entityId?: string): Promise<Bill[]> {
  const entityClause = entityId ? 'AND entity_id=$2' : '';
  const params = entityId ? [userId, entityId] : [userId];
  // Auto-update unpaid bills that are past due_date to 'overdue'
  await query(
    `UPDATE bills SET status = 'overdue' WHERE user_id = $1 ${entityClause} AND status = 'unpaid' AND due_date < CURRENT_DATE`,
    params
  );
  const r = await query(
    `SELECT * FROM bills WHERE user_id = $1 ${entityClause} ORDER BY due_date ASC, created_at DESC`,
    params
  );
  return r.rows as Bill[];
}

export async function getBillById(userId: string, id: string, entityId?: string): Promise<Bill | null> {
  if (entityId) {
    const r = await query(`SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND entity_id = $3`, [id, userId, entityId]);
    return r.rows[0] as Bill || null;
  }
  const r = await query(`SELECT * FROM bills WHERE id = $1 AND user_id = $2`, [id, userId]);
  return r.rows[0] as Bill || null;
}

export async function updateBill(userId: string, id: string, data: {
  supplierName?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  category?: string;
  notes?: string;
  reference?: string;
  status?: string;
}) {
  const r = await query(
    `UPDATE bills SET
       supplier_name = COALESCE($3, supplier_name),
       amount = COALESCE($4, amount),
       currency = COALESCE($5, currency),
       due_date = COALESCE($6, due_date),
       category = COALESCE($7, category),
       notes = COALESCE($8, notes),
       reference = COALESCE($9, reference),
       status = COALESCE($10, status)
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      id, userId,
      data.supplierName || null,
      data.amount ?? null,
      data.currency || null,
      data.dueDate || null,
      data.category || null,
      data.notes || null,
      data.reference || null,
      data.status || null,
    ]
  );
  return r.rows[0] as Bill || null;
}

export async function deleteBill(userId: string, id: string) {
  await query(`DELETE FROM bills WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export async function markBillPaid(
  userId: string,
  id: string,
  entityId?: string,
  options?: {
    paymentDate?: string;
    bankAccountId?: string;
    reference?: string;
    isPrepayment?: boolean;
    prepaymentMonths?: number;
    prepaymentExpAcctId?: string;
  }
): Promise<Bill | null> {
  const paymentDate = options?.paymentDate || new Date().toISOString().split('T')[0];

  // Read the bill first so we have supplier_name + amount for the GL description
  const existing = await query(
    `SELECT * FROM bills WHERE id=$1 AND user_id=$2${entityId ? ' AND entity_id=$3' : ''}`,
    entityId ? [id, userId, entityId] : [id, userId]
  );
  const existingBill = existing.rows[0] as Bill | undefined;
  if (!existingBill) return null;

  if (!entityId) {
    // No entity context — just mark paid, no GL
    await query(`UPDATE bills SET status='paid', paid_at=$1::timestamptz WHERE id=$2`, [paymentDate, id]);
    return (await query('SELECT * FROM bills WHERE id=$1', [id])).rows[0] as Bill;
  }

  const isPrepayment = options?.isPrepayment ?? false;

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE bills SET status='paid', paid_at=$1::timestamptz WHERE id=$2`,
      [paymentDate, id]
    );

    const btR = await client.query(
      `INSERT INTO bank_transactions
         (user_id, entity_id, transaction_date, description, amount, type, matched_bill_id, status,
          category, categorisation_type, is_prepayment, prepayment_months, prepayment_exp_acct)
       VALUES ($1, $2, $3, $4, $5, 'debit', $6, 'matched', $7, 'manual', $8, $9, $10)
       RETURNING id`,
      [
        userId, entityId, paymentDate,
        `Payment to ${existingBill.supplier_name}${options?.reference ? ` (${options.reference})` : ''}`,
        existingBill.amount, id, existingBill.category || 'general',
        isPrepayment, options?.prepaymentMonths ?? null, options?.prepaymentExpAcctId ?? null,
      ]
    );

    if (isPrepayment) {
      // Dr Prepayments (1300) / Cr Bank — defer expense to future releases
      const prepayAcct = await getAccountByCode(entityId, 1300);
      const bankAcct = options?.bankAccountId
        ? { id: options.bankAccountId }
        : await getAccountByCode(entityId, 1200);
      if (!prepayAcct || !bankAcct) throw new Error('Prepayments (1300) or Bank account not found');
      await postJournalEntry({
        entityId,
        userId,
        date:        paymentDate,
        description: `Prepayment — ${existingBill.supplier_name}`,
        reference:   options?.reference,
        sourceType:  'prepayment',
        sourceId:    btR.rows[0].id,
        lines: [
          { accountId: prepayAcct.id, description: 'Prepayments asset', debit: parseFloat(existingBill.amount), credit: 0 },
          { accountId: bankAcct.id,   description: 'Bank payment',       debit: 0, credit: parseFloat(existingBill.amount) },
        ],
      }, client);
    } else {
      const glLines = await buildBillPaymentLines(entityId, parseFloat(existingBill.amount), options?.bankAccountId);
      await postJournalEntry({
        entityId,
        userId,
        date:        paymentDate,
        description: `Payment to ${existingBill.supplier_name}`,
        reference:   options?.reference,
        sourceType:  'payment',
        sourceId:    id,
        lines:       glLines,
      }, client);
    }

    return (await client.query('SELECT * FROM bills WHERE id=$1', [id])).rows[0] as Bill;
  });
}

export async function getBillStats(userId: string, entityId?: string) {
  const entityClause = entityId ? 'AND entity_id=$2' : '';
  const params = entityId ? [userId, entityId] : [userId];
  const r = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) AS total_unpaid,
       COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) AS total_overdue,
       COALESCE(SUM(CASE WHEN status = 'paid' AND date_trunc('month', paid_at) = date_trunc('month', NOW()) THEN amount ELSE 0 END), 0) AS total_paid_this_month
     FROM bills WHERE user_id = $1 ${entityClause}`,
    params
  );
  const row = r.rows[0];
  return {
    totalUnpaid: parseFloat(row.total_unpaid),
    totalOverdue: parseFloat(row.total_overdue),
    totalPaidThisMonth: parseFloat(row.total_paid_this_month),
  };
}
