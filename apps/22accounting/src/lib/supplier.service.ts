import { query } from './db';
import { dispatchWebhookEvent } from './webhook.service';

export interface Supplier {
  id: string;
  user_id: string;
  entity_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export async function getAllSuppliers(userId: string, entityId: string): Promise<Supplier[]> {
  const r = await query(
    `SELECT id, name, email, phone, address, notes, created_at
     FROM suppliers WHERE user_id = $1 AND entity_id = $2 ORDER BY name ASC`,
    [userId, entityId]
  );
  return r.rows as Supplier[];
}

export async function createSupplier(data: {
  userId: string;
  entityId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}): Promise<Supplier> {
  const r = await query(
    `INSERT INTO suppliers (user_id, entity_id, name, email, phone, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.userId, data.entityId, data.name, data.email || null, data.phone || null, data.address || null, data.notes || null]
  );
  const supplier = r.rows[0] as Supplier;

  dispatchWebhookEvent(data.entityId, 'supplier.created', { supplier }).catch(() => {});

  return supplier;
}

export async function getSupplierById(supplierId: string, userId: string, entityId?: string): Promise<Supplier | null> {
  const r = await query(
    `SELECT id, name, email, phone, address, notes, created_at
     FROM suppliers WHERE id = $1 AND user_id = $2 ${entityId ? 'AND entity_id = $3' : ''}`,
    entityId ? [supplierId, userId, entityId] : [supplierId, userId]
  );
  return r.rows[0] as Supplier || null;
}

export async function updateSupplier(supplierId: string, userId: string, data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}, entityId?: string): Promise<Supplier | null> {
  const r = await query(
    `UPDATE suppliers SET
       name = $1, email = $2, phone = $3, address = $4, notes = $5
     WHERE id = $6 AND user_id = $7 ${entityId ? 'AND entity_id = $8' : ''} RETURNING *`,
    entityId
      ? [data.name, data.email || null, data.phone || null, data.address || null, data.notes || null, supplierId, userId, entityId]
      : [data.name, data.email || null, data.phone || null, data.address || null, data.notes || null, supplierId, userId]
  );
  return r.rows[0] as Supplier || null;
}

export async function deleteSupplier(supplierId: string, userId: string, entityId: string): Promise<boolean> {
  const r = await query(
    `DELETE FROM suppliers WHERE id = $1 AND user_id = $2 AND entity_id = $3 RETURNING id`,
    [supplierId, userId, entityId]
  );
  return (r.rowCount ?? 0) > 0;
}
