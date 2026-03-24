import { query } from './db';

export interface POSettings {
  id: string;
  entity_id: string;
  enabled: boolean;
  approver_user_id: string | null;
  approval_threshold: string;
  variance_tolerance_pct: string;
}

export interface PurchaseOrder {
  id: string;
  entity_id: string;
  user_id: string;
  po_number: string;
  supplier_name: string;
  description: string | null;
  currency: string;
  subtotal: string;
  vat_amount: string;
  total: string;
  status: string;
  requested_by_id: string;
  requested_by_name?: string;
  approved_by_id: string | null;
  approved_by_name?: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  approval_token: string;
  approval_token_expires_at: string;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface POItem {
  id: string;
  po_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  vat_rate: string;
  line_order: number;
}

// ---------- Settings ----------

export async function getPOSettings(entityId: string): Promise<POSettings | null> {
  const r = await query(
    `SELECT * FROM po_settings WHERE entity_id = $1`,
    [entityId]
  );
  return r.rows[0] || null;
}

export async function upsertPOSettings(entityId: string, data: {
  enabled: boolean;
  approverUserId?: string | null;
  approvalThreshold: number;
  varianceTolerancePct: number;
}): Promise<POSettings> {
  const r = await query(
    `INSERT INTO po_settings (entity_id, enabled, approver_user_id, approval_threshold, variance_tolerance_pct)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entity_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       approver_user_id = EXCLUDED.approver_user_id,
       approval_threshold = EXCLUDED.approval_threshold,
       variance_tolerance_pct = EXCLUDED.variance_tolerance_pct,
       updated_at = NOW()
     RETURNING *`,
    [entityId, data.enabled, data.approverUserId || null, data.approvalThreshold, data.varianceTolerancePct]
  );
  return r.rows[0] as POSettings;
}

// ---------- PO CRUD ----------

export async function generatePONumber(): Promise<string> {
  const year = new Date().getFullYear();
  const r = await query(`SELECT nextval('po_number_seq') AS num`);
  return `PO-${year}-${String(r.rows[0].num).padStart(4, '0')}`;
}

export async function createPO(data: {
  entityId: string;
  userId: string;
  requestedById: string;
  supplierName: string;
  description?: string;
  currency: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; vatRate: number }>;
  expectedDate?: string;
  notes?: string;
  status: 'pending_approval' | 'approved';
}): Promise<PurchaseOrder> {
  const poNumber = await generatePONumber();

  let subtotal = 0;
  const processedItems = data.items.map((item, idx) => {
    const amount = item.quantity * item.unitPrice;
    subtotal += amount;
    return { ...item, amount, lineOrder: idx };
  });
  const vatAmount = processedItems.reduce((s, i) => s + i.amount * (i.vatRate / 100), 0);
  const total = subtotal + vatAmount;

  const r = await query(
    `INSERT INTO purchase_orders
       (entity_id, user_id, po_number, supplier_name, description, currency,
        subtotal, vat_amount, total, status, requested_by_id, expected_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      data.entityId, data.userId, poNumber, data.supplierName,
      data.description || null, data.currency,
      subtotal.toFixed(2), vatAmount.toFixed(2), total.toFixed(2),
      data.status, data.requestedById,
      data.expectedDate || null, data.notes || null,
    ]
  );
  const po = r.rows[0] as PurchaseOrder;

  for (const item of processedItems) {
    await query(
      `INSERT INTO po_items (po_id, description, quantity, unit_price, amount, vat_rate, line_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [po.id, item.description, item.quantity, item.unitPrice, item.amount.toFixed(2), item.vatRate, item.lineOrder]
    );
  }

  return po;
}

export async function getPOsByEntity(entityId: string, status?: string): Promise<PurchaseOrder[]> {
  const statusClause = status ? `AND po.status = $2` : '';
  const params = status ? [entityId, status] : [entityId];
  const r = await query(
    `SELECT po.*,
       req.full_name AS requested_by_name,
       apr.full_name AS approved_by_name
     FROM purchase_orders po
     LEFT JOIN users req ON po.requested_by_id = req.id
     LEFT JOIN users apr ON po.approved_by_id = apr.id
     WHERE po.entity_id = $1 ${statusClause}
     ORDER BY po.created_at DESC`,
    params
  );
  return r.rows as PurchaseOrder[];
}

export async function getPOById(poId: string, entityId: string): Promise<(PurchaseOrder & { items: POItem[] }) | null> {
  const r = await query(
    `SELECT po.*,
       req.full_name AS requested_by_name,
       req.email AS requested_by_email,
       apr.full_name AS approved_by_name
     FROM purchase_orders po
     LEFT JOIN users req ON po.requested_by_id = req.id
     LEFT JOIN users apr ON po.approved_by_id = apr.id
     WHERE po.id = $1 AND po.entity_id = $2`,
    [poId, entityId]
  );
  if (!r.rows[0]) return null;
  const items = await query(
    `SELECT * FROM po_items WHERE po_id = $1 ORDER BY line_order`,
    [poId]
  );
  return { ...r.rows[0], items: items.rows } as PurchaseOrder & { items: POItem[] };
}

export async function getPOByToken(token: string): Promise<(PurchaseOrder & { items: POItem[] }) | null> {
  const r = await query(
    `SELECT po.*,
       req.full_name AS requested_by_name,
       req.email AS requested_by_email,
       ent.name AS entity_name
     FROM purchase_orders po
     LEFT JOIN users req ON po.requested_by_id = req.id
     LEFT JOIN entities ent ON po.entity_id = ent.id
     WHERE po.approval_token = $1
       AND po.approval_token_expires_at > NOW()
       AND po.status = 'pending_approval'`,
    [token]
  );
  if (!r.rows[0]) return null;
  const items = await query(`SELECT * FROM po_items WHERE po_id = $1 ORDER BY line_order`, [r.rows[0].id]);
  return { ...r.rows[0], items: items.rows } as PurchaseOrder & { items: POItem[] };
}

export async function approvePO(poId: string, approverId: string, entityId: string): Promise<PurchaseOrder | null> {
  const r = await query(
    `UPDATE purchase_orders SET
       status = 'approved',
       approved_by_id = $3,
       approved_at = NOW(),
       updated_at = NOW()
     WHERE id = $1 AND entity_id = $2 AND status = 'pending_approval'
     RETURNING *`,
    [poId, entityId, approverId]
  );
  return r.rows[0] || null;
}

export async function approvePOByToken(token: string, approverId: string): Promise<PurchaseOrder | null> {
  const r = await query(
    `UPDATE purchase_orders SET
       status = 'approved',
       approved_by_id = $2,
       approved_at = NOW(),
       updated_at = NOW()
     WHERE approval_token = $1
       AND approval_token_expires_at > NOW()
       AND status = 'pending_approval'
     RETURNING *`,
    [token, approverId]
  );
  return r.rows[0] || null;
}

export async function rejectPO(poId: string, approverId: string, entityId: string, reason: string): Promise<PurchaseOrder | null> {
  const r = await query(
    `UPDATE purchase_orders SET
       status = 'rejected',
       approved_by_id = $3,
       rejected_at = NOW(),
       rejection_reason = $4,
       updated_at = NOW()
     WHERE id = $1 AND entity_id = $2 AND status = 'pending_approval'
     RETURNING *`,
    [poId, entityId, approverId, reason]
  );
  return r.rows[0] || null;
}

export async function rejectPOByToken(token: string, approverId: string, reason: string): Promise<PurchaseOrder | null> {
  const r = await query(
    `UPDATE purchase_orders SET
       status = 'rejected',
       approved_by_id = $2,
       rejected_at = NOW(),
       rejection_reason = $3,
       updated_at = NOW()
     WHERE approval_token = $1
       AND approval_token_expires_at > NOW()
       AND status = 'pending_approval'
     RETURNING *`,
    [token, approverId, reason]
  );
  return r.rows[0] || null;
}

export async function cancelPO(poId: string, entityId: string): Promise<PurchaseOrder | null> {
  const r = await query(
    `UPDATE purchase_orders SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND entity_id = $2 AND status IN ('pending_approval','approved')
     RETURNING *`,
    [poId, entityId]
  );
  return r.rows[0] || null;
}

export async function fulfillPO(poId: string, entityId: string, withVariance: boolean): Promise<PurchaseOrder | null> {
  const status = withVariance ? 'fulfilled_with_variance' : 'fulfilled';
  const r = await query(
    `UPDATE purchase_orders SET status = $3, updated_at = NOW()
     WHERE id = $1 AND entity_id = $2 AND status = 'approved'
     RETURNING *`,
    [poId, entityId, status]
  );
  return r.rows[0] || null;
}

export async function getApprovedPOsForLinking(entityId: string): Promise<PurchaseOrder[]> {
  const r = await query(
    `SELECT po.* FROM purchase_orders po
     WHERE po.entity_id = $1
       AND po.status = 'approved'
       AND NOT EXISTS (
         SELECT 1 FROM bills b WHERE b.po_id = po.id
       )
     ORDER BY po.created_at DESC`,
    [entityId]
  );
  return r.rows as PurchaseOrder[];
}
