import * as Sentry from '@sentry/nextjs';
import { query, withTransaction } from './db';
import {
  postJournalEntry,
  reverseJournalEntry,
  buildInvoiceCreationLines,
  buildInvoicePaymentLines,
} from './general_ledger.service';
import { dispatchWebhookEvent } from './webhook.service';

export async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const r = await query('SELECT nextval(\'invoice_number_seq\') as num');
  return `INV-${year}-${String(r.rows[0].num).padStart(4, '0')}`;
}

export async function createInvoice(data: {
  userId: string;
  entityId: string;
  customerId?: string; // optional link to a saved customer
  projectId?: string; // optional project link
  clientName: string; clientEmail?: string; clientAddress?: string;
  issueDate?: string; dueDate: string; taxRate: number; paymentTerms?: string;
  notes?: string; terms?: string; currency: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>;
  skipGLPosting?: boolean; // set true during migration — GL handled by opening balances import
}) {
  // generateInvoiceNumber uses nextval — must run outside the transaction
  const num = await generateInvoiceNumber();
  let subtotal = 0;
  const processedItems = data.items.map((item, idx) => {
    const amount = item.quantity * item.unitPrice;
    subtotal += amount;
    return { ...item, amount, taxAmount: amount * (item.taxRate / 100), lineOrder: idx };
  });
  const taxAmount = subtotal * (data.taxRate / 100);
  const total = subtotal + taxAmount;
  const fee = total * 0.025;

  const result = await withTransaction(async (client) => {
    const r = await client.query(
      `INSERT INTO acc_invoices (user_id,entity_id,customer_id,project_id,invoice_number,client_name,client_email,client_address,issue_date,due_date,subtotal,tax_rate,tax_amount,total,currency,relentify_fee_amount,notes,terms,payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [data.userId, data.entityId, data.customerId ?? null, data.projectId ?? null, num,
       data.clientName, data.clientEmail ?? null, data.clientAddress ?? null,
       data.issueDate || new Date().toISOString().split('T')[0], data.dueDate,
       subtotal.toFixed(2), data.taxRate, taxAmount.toFixed(2), total.toFixed(2),
       data.currency, fee.toFixed(2), data.notes ?? null, data.terms ?? null,
       data.paymentTerms ?? 'net_30']
    );
    const inv = r.rows[0];

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO acc_invoice_items
           (invoice_id,description,quantity,unit_price,amount,tax_rate,tax_amount,line_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [inv.id, item.description, item.quantity, item.unitPrice,
         item.amount, item.taxRate, item.taxAmount, item.lineOrder]
      );
    }

    // GL posting is inside the transaction — failure rolls back the invoice too
    if (!data.skipGLPosting) {
      const glLines = await buildInvoiceCreationLines(
        data.entityId,
        parseFloat(total.toFixed(2)),
        parseFloat(subtotal.toFixed(2)),
        parseFloat(taxAmount.toFixed(2))
      );
      await postJournalEntry({
        entityId:    data.entityId,
        userId:      data.userId,
        date:        data.issueDate || new Date().toISOString().split('T')[0],
        reference:   num,
        description: `Invoice to ${data.clientName}`,
        sourceType:  'invoice',
        sourceId:    inv.id,
        lines:       glLines,
      }, client);
    }

    return inv;
  });

  dispatchWebhookEvent(data.entityId, 'invoice.created', { invoice: result }).catch(() => {});

  return result;
}

export async function getInvoicesByUser(userId: string, entityId?: string) {
  if (entityId) {
    const r = await query('SELECT * FROM acc_invoices WHERE user_id=$1 AND entity_id=$2 ORDER BY created_at DESC', [userId, entityId]);
    return r.rows;
  }
  const r = await query('SELECT * FROM acc_invoices WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
  return r.rows;
}

export async function getInvoiceById(invoiceId: string, userId: string, entityId?: string) {
  const r = entityId
    ? await query('SELECT * FROM acc_invoices WHERE id=$1 AND user_id=$2 AND entity_id=$3', [invoiceId, userId, entityId])
    : await query('SELECT * FROM acc_invoices WHERE id=$1 AND user_id=$2', [invoiceId, userId]);
  if (!r.rows[0]) return null;
  const items = await query('SELECT * FROM acc_invoice_items WHERE invoice_id=$1 ORDER BY line_order', [invoiceId]);
  return { ...r.rows[0], items: items.rows };
}

export async function updateInvoicePaymentLink(invoiceId: string, link: string, sessionId: string) {
  await query('UPDATE acc_invoices SET stripe_payment_link=$1, stripe_checkout_session_id=$2, status=$3, sent_at=NOW() WHERE id=$4', [link, sessionId, 'sent', invoiceId]);
}

export async function getInvoiceByCheckoutSession(sessionId: string) {
  const r = await query(
    'SELECT i.*, u.stripe_account_id FROM acc_invoices i JOIN users u ON i.user_id=u.id WHERE i.stripe_checkout_session_id=$1', [sessionId]
  );
  return r.rows[0] || null;
}

export async function markInvoicePaid(invoiceId: string, paymentIntentId: string) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE acc_invoices SET status=$1, paid_at=NOW(), stripe_payment_intent_id=$2, payment_method=$3 WHERE id=$4`,
      ['paid', paymentIntentId, 'stripe', invoiceId]
    );

    const inv = await client.query('SELECT * FROM acc_invoices WHERE id=$1', [invoiceId]);
    if (inv.rows[0]) {
      const invoice = inv.rows[0];
      const glLines = await buildInvoicePaymentLines(
        invoice.entity_id,
        parseFloat(invoice.total)
      );
      await postJournalEntry({
        entityId:    invoice.entity_id,
        userId:      invoice.user_id,
        date:        new Date().toISOString().split('T')[0],
        reference:   invoice.invoice_number,
        description: `Payment received: ${invoice.client_name}`,
        sourceType:  'payment',
        sourceId:    invoiceId,
        lines:       glLines,
      }, client);
    }
  });
}

export async function markInvoicePaidManually(
  invoiceId: string,
  userId: string,
  entityId: string,
  options?: {
    paymentDate?: string;
    amount?: number;
    bankAccountId?: string;
    reference?: string;
  }
) {
  const paymentDate = options?.paymentDate || new Date().toISOString().split('T')[0];

  // Read invoice outside transaction — we need it to validate before starting tx
  const invRes = await query('SELECT * FROM acc_invoices WHERE id=$1 AND entity_id=$2', [invoiceId, entityId]);
  const invoice = invRes.rows[0];
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'paid') throw new Error('Invoice is already paid');

  const amount = options?.amount ?? parseFloat(invoice.total);

  const result = await withTransaction(async (client) => {
    await client.query(
      `UPDATE acc_invoices SET status='paid', paid_at=$1::timestamptz, payment_method='bank_transfer' WHERE id=$2`,
      [paymentDate, invoiceId]
    );

    await client.query(
      `INSERT INTO acc_bank_transactions
         (user_id, entity_id, transaction_date, description, amount, type, matched_invoice_id, status, category, categorisation_type)
       VALUES ($1, $2, $3, $4, $5, 'credit', $6, 'matched', 'income', 'manual')`,
      [
        userId, entityId, paymentDate,
        `Payment received: ${invoice.client_name}${options?.reference ? ` (${options.reference})` : ''}`,
        amount.toFixed(2), invoiceId,
      ]
    );

    const glLines = await buildInvoicePaymentLines(entityId, amount, options?.bankAccountId);
    await postJournalEntry({
      entityId,
      userId,
      date:        paymentDate,
      reference:   options?.reference || invoice.invoice_number,
      description: `Payment received: ${invoice.client_name}`,
      sourceType:  'payment',
      sourceId:    invoiceId,
      lines:       glLines,
    }, client);

    const updated = await client.query('SELECT * FROM acc_invoices WHERE id=$1', [invoiceId]);
    return updated.rows[0];
  });

  dispatchWebhookEvent(entityId, 'invoice.paid', { invoice: result }).catch(() => {});

  return result;
}

export async function voidInvoice(invoiceId: string, userId: string) {
  const inv = await query('SELECT * FROM acc_invoices WHERE id=$1', [invoiceId]);
  if (!inv.rows[0]) throw new Error('Invoice not found');
  const invoice = inv.rows[0];

  await withTransaction(async (client) => {
    await client.query(`UPDATE acc_invoices SET status='void' WHERE id=$1`, [invoiceId]);

    // Find and reverse the original GL entry (no is_locked filter — reversal creates a new entry)
    const entry = await client.query(
      `SELECT id FROM acc_journal_entries
       WHERE source_type='invoice' AND source_id=$1
       ORDER BY created_at ASC LIMIT 1`,
      [invoiceId]
    );
    if (entry.rows[0]) {
      await reverseJournalEntry(
        entry.rows[0].id,
        userId,
        new Date().toISOString().split('T')[0],
        client
      );
    }
  });

  dispatchWebhookEvent(invoice.entity_id, 'invoice.voided', { invoice: { id: invoiceId, status: 'void' } }).catch(() => {});
}

export async function getDashboardStats(userId: string, entityId?: string) {
  const entityClause = entityId ? 'AND entity_id=$2' : '';
  const params = entityId ? [userId, entityId] : [userId];

  const r = await query(
    `SELECT COUNT(*) as total_invoices,
      COUNT(*) FILTER (WHERE status='draft') as draft_count,
      COUNT(*) FILTER (WHERE status='sent') as sent_count,
      COUNT(*) FILTER (WHERE status='paid') as paid_count,
      COUNT(*) FILTER (WHERE status='overdue') as overdue_count,
      COALESCE(SUM(total) FILTER (WHERE status='paid'),0) as total_revenue,
      COALESCE(SUM(total) FILTER (WHERE status IN ('sent','overdue')),0) as outstanding_amount,
      COALESCE(SUM(total),0) as total_invoiced
     FROM acc_invoices WHERE user_id=$1 ${entityClause}`, params
  );

  // safe defaults so the caller can rely on numbers and arrays
  const stats = r.rows[0] || {};

  // fetch the latest few invoices for dashboard display
  const recentRes = await query(
    `SELECT id, invoice_number, client_name, due_date, total, status
     FROM acc_invoices WHERE user_id=$1 ${entityClause}
     ORDER BY created_at DESC LIMIT 5`,
    params
  );
  const recent = recentRes.rows || [];

  return {
    // keep original counts in case someone uses snake_case
    total_invoices: stats.total_invoices || 0,
    draft_count: stats.draft_count || 0,
    sent_count: stats.sent_count || 0,
    paid_count: stats.paid_count || 0,
    overdue_count: stats.overdue_count || 0,
    total_revenue: parseFloat(stats.total_revenue || "0"),
    outstanding_amount: parseFloat(stats.outstanding_amount || "0"),
    total_invoiced: stats.total_invoiced || 0,
    // include query result, default to empty array
    recent_invoices: recent,
    // camelCase aliases for frontend convenience
    totalInvoices: stats.total_invoices || 0,
    draftCount: stats.draft_count || 0,
    sentCount: stats.sent_count || 0,
    paidCount: stats.paid_count || 0,
    overdueCount: stats.overdue_count || 0,
    totalRevenue: parseFloat(stats.total_revenue || "0"),
    totalPaid: parseFloat(stats.total_revenue || "0"),
    totalOutstanding: parseFloat(stats.outstanding_amount || "0"),
    totalInvoiced: parseFloat(stats.total_invoiced || "0"),
    recentInvoices: recent,
  };
}

export async function getInvoicesByCustomer(userId: string, customerId: string, entityId?: string) {
  if (entityId) {
    const r = await query(
      `SELECT * FROM acc_invoices WHERE user_id=$1 AND customer_id=$2 AND entity_id=$3 ORDER BY created_at DESC`,
      [userId, customerId, entityId]
    );
    return r.rows;
  }
  const r = await query(
    `SELECT * FROM acc_invoices WHERE user_id=$1 AND customer_id=$2 ORDER BY created_at DESC`,
    [userId, customerId]
  );
  return r.rows;
}
