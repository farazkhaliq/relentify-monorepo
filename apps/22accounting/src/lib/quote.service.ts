import { query, withTransaction } from './db';
import { createInvoice } from './invoice.service';

export async function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const r = await query(`SELECT nextval('quote_number_seq') as num`);
  return `QTE-${year}-${String(r.rows[0].num).padStart(4, '0')}`;
}

export async function createQuote(data: {
  userId: string;
  customerId?: string;
  clientName: string; clientEmail?: string; clientAddress?: string;
  issueDate?: string; validUntil: string;
  taxRate: number; currency: string;
  notes?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>;
}) {
  const num = await generateQuoteNumber();
  let subtotal = 0;
  const processedItems = data.items.map((item, idx) => {
    const amount = item.quantity * item.unitPrice;
    subtotal += amount;
    return { ...item, amount, taxAmount: amount * (item.taxRate / 100), lineOrder: idx };
  });
  const taxAmount = subtotal * (data.taxRate / 100);
  const total = subtotal + taxAmount;

  const r = await query(
    `INSERT INTO quotes (user_id, customer_id, quote_number, client_name, client_email, client_address,
       issue_date, valid_until, subtotal, tax_rate, tax_amount, total, currency, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      data.userId, data.customerId || null, num, data.clientName,
      data.clientEmail || null, data.clientAddress || null,
      data.issueDate || new Date().toISOString().split('T')[0], data.validUntil,
      subtotal.toFixed(2), data.taxRate, taxAmount.toFixed(2), total.toFixed(2),
      data.currency, data.notes || null,
    ]
  );
  const qt = r.rows[0];
  for (const item of processedItems) {
    await query(
      `INSERT INTO quote_items (quote_id, description, quantity, unit_price, amount, tax_rate, tax_amount, line_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [qt.id, item.description, item.quantity, item.unitPrice, item.amount, item.taxRate, item.taxAmount, item.lineOrder]
    );
  }
  return qt;
}

export async function getQuotesByUser(userId: string) {
  // Auto-expire quotes past valid_until
  await query(
    `UPDATE quotes SET status='expired'
     WHERE user_id=$1 AND status IN ('draft','sent') AND valid_until < CURRENT_DATE`,
    [userId]
  );
  const r = await query(`SELECT * FROM quotes WHERE user_id=$1 ORDER BY created_at DESC`, [userId]);
  return r.rows;
}

export async function getQuoteById(quoteId: string, userId: string) {
  const r = await query(`SELECT * FROM quotes WHERE id=$1 AND user_id=$2`, [quoteId, userId]);
  if (!r.rows[0]) return null;
  const items = await query(`SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY line_order`, [quoteId]);
  return { ...r.rows[0], items: items.rows };
}

export async function updateQuoteStatus(quoteId: string, userId: string, status: string) {
  const r = await query(
    `UPDATE quotes SET status=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *`,
    [status, quoteId, userId]
  );
  return r.rows[0] || null;
}

export async function deleteQuote(quoteId: string, userId: string) {
  await query(`DELETE FROM quotes WHERE id=$1 AND user_id=$2`, [quoteId, userId]);
}

export async function convertQuoteToInvoice(quoteId: string, userId: string, entityId: string) {
  // Read outside transaction — needed before we start any writes
  const qt = await getQuoteById(quoteId, userId);
  if (!qt) throw new Error('Quote not found');
  if (qt.converted_invoice_id) throw new Error('Already converted');

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  // createInvoice is atomic in its own transaction.
  // Call it first: if it throws, the quote status stays unchanged.
  const inv = await createInvoice({
    userId,
    entityId,
    customerId: qt.customer_id,
    clientName: qt.client_name,
    clientEmail: qt.client_email,
    clientAddress: qt.client_address,
    dueDate: dueDate.toISOString().split('T')[0],
    taxRate: parseFloat(qt.tax_rate),
    currency: qt.currency,
    notes: qt.notes,
    items: qt.items.map((i: { description: string; quantity: string; unit_price: string; tax_rate: string }) => ({
      description: i.description,
      quantity: parseFloat(i.quantity),
      unitPrice: parseFloat(i.unit_price),
      taxRate: parseFloat(i.tax_rate),
    })),
  });

  // Mark quote as accepted — wrap in transaction so the two UPDATEs are atomic
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE quotes SET status='accepted', converted_invoice_id=$1, updated_at=NOW() WHERE id=$2`,
      [inv.id, quoteId]
    );
  });

  return inv;
}
