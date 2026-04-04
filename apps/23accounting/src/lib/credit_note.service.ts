import { query, withTransaction } from './db';
import { postJournalEntry, reverseJournalEntry } from './general_ledger.service';
import { getAccountByCode } from './chart_of_accounts.service';
import { logAudit } from './audit.service';

export async function generateCreditNoteNumber() {
  const year = new Date().getFullYear();
  const r = await query("SELECT nextval('credit_note_number_seq') as num");
  return `CN-${year}-${String(r.rows[0].num).padStart(4, '0')}`;
}

export async function createCreditNote(data: {
  userId: string;
  entityId: string;
  customerId?: string;
  invoiceId?: string;
  clientName: string;
  clientEmail?: string;
  issueDate?: string;
  taxRate: number;
  reason?: string;
  notes?: string;
  currency: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>;
}) {
  // generateCreditNoteNumber uses nextval — must run outside the transaction
  const num = await generateCreditNoteNumber();
  let subtotal = 0;
  const processedItems = data.items.map((item, idx) => {
    const amount = item.quantity * item.unitPrice;
    subtotal += amount;
    return { ...item, amount, taxAmount: amount * (item.taxRate / 100), lineOrder: idx };
  });
  const taxAmount = subtotal * (data.taxRate / 100);
  const total = subtotal + taxAmount;
  const issueDate = data.issueDate || new Date().toISOString().split('T')[0];

  return withTransaction(async (client) => {
    const r = await client.query(
      `INSERT INTO acc_credit_notes
         (user_id, entity_id, customer_id, invoice_id, credit_note_number,
          client_name, client_email, issue_date, subtotal, tax_rate, tax_amount,
          total, currency, reason, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        data.userId, data.entityId, data.customerId || null, data.invoiceId || null,
        num, data.clientName, data.clientEmail || null, issueDate,
        subtotal.toFixed(2), data.taxRate, taxAmount.toFixed(2),
        total.toFixed(2), data.currency, data.reason || null, data.notes || null,
      ]
    );
    const cn = r.rows[0];

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO acc_credit_note_items
           (credit_note_id, description, quantity, unit_price, amount, tax_rate, tax_amount, line_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cn.id, item.description, item.quantity, item.unitPrice,
         item.amount.toFixed(2), item.taxRate, item.taxAmount.toFixed(2), item.lineOrder]
      );
    }

    // GL: Dr Sales / Dr VAT Output / Cr Debtors (reverse of invoice)
    // Account lookups use pool reads; write (postJournalEntry) uses client
    const debtors = await getAccountByCode(data.entityId, 1100);
    const sales   = await getAccountByCode(data.entityId, 4000);
    if (!debtors || !sales) throw new Error('Could not resolve GL accounts for credit note');

    const glLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
      { accountId: sales.id,   description: 'Sales',           debit: parseFloat(subtotal.toFixed(2)), credit: 0 },
      { accountId: debtors.id, description: 'Debtors Control', debit: 0, credit: parseFloat(total.toFixed(2)) },
    ];
    if (taxAmount > 0) {
      const vatOut = await getAccountByCode(data.entityId, 2202);
      if (!vatOut) throw new Error('Could not resolve VAT Output account for credit note');
      glLines.push({ accountId: vatOut.id, description: 'VAT Output Tax', debit: parseFloat(taxAmount.toFixed(2)), credit: 0 });
    }
    await postJournalEntry({
      entityId:    data.entityId,
      userId:      data.userId,
      date:        issueDate,
      reference:   num,
      description: `Credit note for ${data.clientName}`,
      sourceType:  'credit_note',
      sourceId:    cn.id,
      lines:       glLines,
    }, client);

    await logAudit(data.userId, 'credit_note_created', 'credit_note', cn.id, { number: num, client: data.clientName, total: total.toFixed(2) });
    return cn;
  });
}

export async function getCreditNotesByEntity(entityId: string) {
  const r = await query(
    `SELECT cn.*, i.invoice_number as linked_invoice_number
     FROM acc_credit_notes cn
     LEFT JOIN acc_invoices i ON i.id = cn.invoice_id
     WHERE cn.entity_id = $1
     ORDER BY cn.created_at DESC`,
    [entityId]
  );
  return r.rows;
}

export async function getCreditNoteById(id: string, entityId: string) {
  const r = await query(
    `SELECT cn.*, i.invoice_number as linked_invoice_number
     FROM acc_credit_notes cn
     LEFT JOIN acc_invoices i ON i.id = cn.invoice_id
     WHERE cn.id = $1 AND cn.entity_id = $2`,
    [id, entityId]
  );
  if (!r.rows[0]) return null;
  const cn = r.rows[0];
  const items = await query(
    'SELECT * FROM acc_credit_note_items WHERE credit_note_id = $1 ORDER BY line_order',
    [id]
  );
  return { ...cn, items: items.rows };
}

export async function updateCreditNoteStatus(id: string, entityId: string, status: string) {
  const r = await query(
    `UPDATE acc_credit_notes SET status = $1, updated_at = now()
     WHERE id = $2 AND entity_id = $3 RETURNING *`,
    [status, id, entityId]
  );
  return r.rows[0];
}

export async function voidCreditNote(id: string, entityId: string, userId: string) {
  // Read outside transaction — we need cn.credit_note_number for the audit log
  const cn = await getCreditNoteById(id, entityId);
  if (!cn) throw new Error('Credit note not found');
  if (cn.status === 'voided') throw new Error('Already voided');

  return withTransaction(async (client) => {
    const r = await client.query(
      `UPDATE acc_credit_notes SET status = 'voided', updated_at = now()
       WHERE id = $1 AND entity_id = $2 RETURNING *`,
      [id, entityId]
    );

    // Find and reverse the original GL entry
    const jeRes = await client.query(
      `SELECT id FROM acc_journal_entries
       WHERE source_type = 'credit_note' AND source_id = $1 AND entity_id = $2
       ORDER BY created_at ASC LIMIT 1`,
      [id, entityId]
    );
    if (jeRes.rows[0]) {
      await reverseJournalEntry(jeRes.rows[0].id, userId, new Date().toISOString().split('T')[0], client);
    }

    await logAudit(userId, 'credit_note_voided', 'credit_note', id, { number: cn.credit_note_number });
    return r.rows[0];
  });
}
