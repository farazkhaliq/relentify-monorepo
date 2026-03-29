import { query, withTransaction } from './db';

export async function createIntercompanyTransaction(
  initiatingEntityId: string,
  receivingEntityId: string,
  invoiceId: string,
  userId: string
): Promise<{ link: Record<string, unknown>; mirrorBill: Record<string, unknown> } | null> {
  // Read invoice and validate receiving entity — outside transaction
  const invRes = await query(
    `SELECT * FROM invoices WHERE id = $1 AND entity_id = $2 AND user_id = $3`,
    [invoiceId, initiatingEntityId, userId]
  );
  const invoice = invRes.rows[0];
  if (!invoice) return null;

  const recvRes = await query(
    `SELECT * FROM entities WHERE id = $1 AND user_id = $2`,
    [receivingEntityId, userId]
  );
  if (!recvRes.rows[0]) return null;

  return withTransaction(async (client) => {
    // Create mirror bill in the receiving entity
    const billRes = await client.query(
      `INSERT INTO bills (user_id, entity_id, supplier_name, amount, vat_rate, vat_amount, currency, due_date, category, notes, reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        userId,
        receivingEntityId,
        invoice.client_name || 'Intercompany',
        invoice.total,
        invoice.tax_rate || 0,
        invoice.tax_amount || 0,
        invoice.currency,
        invoice.due_date,
        'intercompany',
        `Intercompany bill (mirror of invoice ${invoice.invoice_number})`,
        invoice.invoice_number,
      ]
    );
    const mirrorBill = billRes.rows[0];

    // Record the link
    const linkRes = await client.query(
      `INSERT INTO intercompany_links (initiating_entity_id, receiving_entity_id, source_invoice_id, mirror_bill_id, amount, currency)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [initiatingEntityId, receivingEntityId, invoiceId, mirrorBill.id, invoice.total, invoice.currency]
    );
    const link = linkRes.rows[0];

    return { link, mirrorBill };
  });
}

export async function getIntercompanyLinks(entityId: string): Promise<Record<string, unknown>[]> {
  const r = await query(
    `SELECT il.*,
       e_init.name as initiating_entity_name,
       e_recv.name as receiving_entity_name,
       i.invoice_number,
       i.client_name
     FROM intercompany_links il
     JOIN entities e_init ON e_init.id = il.initiating_entity_id
     JOIN entities e_recv ON e_recv.id = il.receiving_entity_id
     LEFT JOIN invoices i ON i.id = il.source_invoice_id
     WHERE il.initiating_entity_id = $1 OR il.receiving_entity_id = $1
     ORDER BY il.created_at DESC`,
    [entityId]
  );
  return r.rows;
}
