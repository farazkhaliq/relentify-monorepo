import { query } from './db';

export async function getAllCustomers(userId: string, entityId?: string) {
  if (entityId) {
    const r = await query(
      `SELECT id, name, email, phone, address, notes, created_at
       FROM customers WHERE user_id = $1 AND entity_id = $2 ORDER BY name ASC`,
      [userId, entityId]
    );
    return r.rows;
  }
  const r = await query(
    `SELECT id, name, email, phone, address, notes, created_at
     FROM customers WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  return r.rows;
}

export async function getCustomerById(customerId: string, userId: string, entityId?: string) {
  if (entityId) {
    const r = await query(
      `SELECT * FROM customers WHERE id = $1 AND user_id = $2 AND entity_id = $3`,
      [customerId, userId, entityId]
    );
    return r.rows[0] || null;
  }
  const r = await query(
    `SELECT * FROM customers WHERE id = $1 AND user_id = $2`,
    [customerId, userId]
  );
  return r.rows[0] || null;
}

export async function createCustomer(data: {
  userId: string;
  entityId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}) {
  const r = await query(
    `INSERT INTO customers (user_id, entity_id, name, email, phone, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.userId, data.entityId, data.name, data.email || null, data.phone || null, data.address || null, data.notes || null]
  );
  return r.rows[0];
}

export async function updateCustomer(
  customerId: string,
  userId: string,
  data: { name?: string; email?: string; phone?: string; address?: string; notes?: string },
  entityId?: string
) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push(`email = $${paramCount++}`);
    values.push(data.email);
  }
  if (data.phone !== undefined) {
    fields.push(`phone = $${paramCount++}`);
    values.push(data.phone);
  }
  if (data.address !== undefined) {
    fields.push(`address = $${paramCount++}`);
    values.push(data.address);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${paramCount++}`);
    values.push(data.notes);
  }

  if (fields.length === 0) return null;

  if (entityId) {
    values.push(customerId, userId, entityId);
    const r = await query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} AND entity_id = $${paramCount + 2} RETURNING *`,
      values
    );
    return r.rows[0] || null;
  }

  values.push(customerId, userId);
  const r = await query(
    `UPDATE customers SET ${fields.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`,
    values
  );
  return r.rows[0] || null;
}

export async function deleteCustomer(customerId: string, userId: string, entityId?: string) {
  if (entityId) {
    const r = await query(
      `DELETE FROM customers WHERE id = $1 AND user_id = $2 AND entity_id = $3 RETURNING id`,
      [customerId, userId, entityId]
    );
    return (r.rowCount ?? 0) > 0;
  }
  const r = await query(
    `DELETE FROM customers WHERE id = $1 AND user_id = $2 RETURNING id`,
    [customerId, userId]
  );
  return (r.rowCount ?? 0) > 0;
}
