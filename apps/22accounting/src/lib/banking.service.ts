import { query } from './db';

export interface BankTransaction {
  id: string;
  user_id: string;
  transaction_date: string;
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  matched_invoice_id: string | null;
  matched_bill_id: string | null;
  status: 'unmatched' | 'matched' | 'ignored';
  import_batch_id: string | null;
  connection_id: string | null;
  categorisation_type: string | null;
  category: string | null;
  poa_name: string | null;
  created_at: string;
  // joined fields
  invoice_number?: string;
  bill_supplier?: string;
}

export type MatchAction =
  | { type: 'invoice_match'; invoiceId: string }
  | { type: 'bill_match'; billId: string }
  | { type: 'payment_on_account'; poaName: string }
  | { type: 'bank_entry'; category: string };

export interface CsvRow {
  date: string;
  description: string;
  credit: number;
  debit: number;
}

export async function getTransactions(userId: string, opts: { status?: string; connectionId?: string; entityId?: string } = {}): Promise<BankTransaction[]> {
  const clauses: string[] = ['bt.user_id = $1'];
  const params: unknown[] = [userId];
  if (opts.status) { params.push(opts.status); clauses.push(`bt.status = $${params.length}`); }
  if (opts.connectionId) { params.push(opts.connectionId); clauses.push(`bt.connection_id = $${params.length}`); }
  if (opts.entityId) { params.push(opts.entityId); clauses.push(`bt.entity_id = $${params.length}`); }

  const r = await query(
    `SELECT bt.*,
       i.invoice_number,
       b.supplier_name AS bill_supplier
     FROM acc_bank_transactions bt
     LEFT JOIN acc_invoices i ON i.id = bt.matched_invoice_id
     LEFT JOIN acc_bills b ON b.id = bt.matched_bill_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY bt.transaction_date DESC, bt.created_at DESC`,
    params
  );
  return r.rows as BankTransaction[];
}

export async function autoMatch(userId: string, txId: string, amount: number, txDate: string, type: 'credit' | 'debit') {
  if (type === 'credit') {
    // Try to match against unpaid/sent invoices
    const r = await query(
      `SELECT id FROM acc_invoices
       WHERE user_id = $1
         AND status IN ('sent','overdue')
         AND ABS(total::numeric - $2) <= 0.01
         AND ABS(due_date - $3::date) <= 5
       LIMIT 1`,
      [userId, amount, txDate]
    );
    if (r.rows.length > 0) {
      await query(
        `UPDATE acc_bank_transactions SET status='matched', matched_invoice_id=$1 WHERE id=$2`,
        [r.rows[0].id, txId]
      );
      return { matched: true, invoiceId: r.rows[0].id };
    }
  } else {
    // Try to match against unpaid bills
    const r = await query(
      `SELECT id FROM acc_bills
       WHERE user_id = $1
         AND status IN ('unpaid','overdue')
         AND ABS(amount::numeric - $2) <= 0.01
         AND ABS(due_date - $3::date) <= 5
       LIMIT 1`,
      [userId, amount, txDate]
    );
    if (r.rows.length > 0) {
      await query(
        `UPDATE acc_bank_transactions SET status='matched', matched_bill_id=$1 WHERE id=$2`,
        [r.rows[0].id, txId]
      );
      return { matched: true, billId: r.rows[0].id };
    }
  }
  return { matched: false };
}

export async function importTransactions(userId: string, rows: CsvRow[], entityId?: string) {
  const batchId = crypto.randomUUID();
  const inserted: BankTransaction[] = [];

  for (const row of rows) {
    const isCredit = row.credit > 0;
    const amount = isCredit ? row.credit : row.debit;
    const type: 'credit' | 'debit' = isCredit ? 'credit' : 'debit';

    const r = await query(
      `INSERT INTO acc_bank_transactions (user_id, entity_id, transaction_date, description, amount, type, import_batch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, entityId || null, row.date, row.description, amount, type, batchId]
    );
    const tx = r.rows[0] as BankTransaction;
    inserted.push(tx);
    await autoMatch(userId, tx.id, amount, row.date, type);
  }

  return inserted;
}

export async function manualMatch(userId: string, txId: string, action: MatchAction) {
  const tx = await query(`SELECT id, type FROM acc_bank_transactions WHERE id=$1 AND user_id=$2`, [txId, userId]);
  if (!tx.rows.length) return null;

  if (action.type === 'invoice_match') {
    await query(
      `UPDATE acc_bank_transactions SET status='matched', matched_invoice_id=$1, matched_bill_id=NULL,
       categorisation_type='invoice_match', category=NULL, poa_name=NULL WHERE id=$2`,
      [action.invoiceId, txId]
    );
  } else if (action.type === 'bill_match') {
    await query(
      `UPDATE acc_bank_transactions SET status='matched', matched_bill_id=$1, matched_invoice_id=NULL,
       categorisation_type='bill_match', category=NULL, poa_name=NULL WHERE id=$2`,
      [action.billId, txId]
    );
  } else if (action.type === 'payment_on_account') {
    await query(
      `UPDATE acc_bank_transactions SET status='matched', matched_invoice_id=NULL, matched_bill_id=NULL,
       categorisation_type='payment_on_account', poa_name=$1, category=NULL WHERE id=$2`,
      [action.poaName, txId]
    );
  } else if (action.type === 'bank_entry') {
    await query(
      `UPDATE acc_bank_transactions SET status='matched', matched_invoice_id=NULL, matched_bill_id=NULL,
       categorisation_type='bank_entry', category=$1, poa_name=NULL WHERE id=$2`,
      [action.category, txId]
    );
  }
  return true;
}

export async function ignoreTransaction(userId: string, txId: string) {
  await query(
    `UPDATE acc_bank_transactions SET status='ignored', matched_invoice_id=NULL, matched_bill_id=NULL WHERE id=$1 AND user_id=$2`,
    [txId, userId]
  );
}
