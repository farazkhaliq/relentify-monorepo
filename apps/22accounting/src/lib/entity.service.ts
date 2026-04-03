import { query } from './db';
import { seedDefaultCOA } from './chart_of_accounts.service';

export interface Entity {
  id: string;
  user_id: string;
  name: string;
  business_structure: string | null;
  company_number: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  currency: string;
  country_code: string;
  address: string | null;
  logo_url: string | null;
  brand_color: string | null;
  invoice_footer: string | null;
  phone: string | null;
  website: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  last_fy_end_date: string | null;
  locked_through_date: string | null;
}

export async function getEntitiesByUser(userId: string): Promise<Entity[]> {
  const r = await query(
    `SELECT id, user_id, name, business_structure, company_number, vat_registered, vat_number,
            currency, country_code, address, logo_url, brand_color, invoice_footer, phone, website,
            is_default, created_at, updated_at
     FROM entities WHERE user_id = $1 ORDER BY is_default DESC, name ASC`,
    [userId]
  );
  return r.rows as Entity[];
}

export async function getEntityById(entityId: string, userId: string): Promise<Entity | null> {
  const r = await query(
    `SELECT * FROM entities WHERE id = $1 AND user_id = $2`,
    [entityId, userId]
  );
  return r.rows[0] as Entity || null;
}

export async function getActiveEntity(userId: string): Promise<Entity | null> {
  const r = await query(
    `SELECT e.* FROM entities e
     JOIN users u ON u.active_entity_id = e.id
     WHERE u.id = $1 AND e.user_id = $1`,
    [userId]
  );
  if (r.rows[0]) return r.rows[0] as Entity;

  // Fallback: return default entity if active_entity_id not set
  const fallback = await query(
    `SELECT * FROM entities WHERE user_id = $1 AND is_default = TRUE LIMIT 1`,
    [userId]
  );
  return fallback.rows[0] as Entity || null;
}

export async function createEntity(userId: string, data: {
  name: string;
  businessStructure?: string;
  companyNumber?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  currency?: string;
  countryCode?: string;
  address?: string;
}): Promise<Entity> {
  // Check if this is the first entity — make it default
  const count = await query(`SELECT COUNT(*) as c FROM entities WHERE user_id = $1`, [userId]);
  const isFirst = parseInt(count.rows[0].c) === 0;

  const r = await query(
    `INSERT INTO entities (user_id, name, business_structure, company_number, vat_registered, vat_number, currency, country_code, address, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      userId,
      data.name,
      data.businessStructure || null,
      data.companyNumber || null,
      data.vatRegistered || false,
      data.vatNumber || null,
      data.currency || 'GBP',
      data.countryCode || 'GB',
      data.address || null,
      isFirst,
    ]
  );
  const entity = r.rows[0] as Entity;

  if (isFirst) {
    await query(`UPDATE users SET active_entity_id = $1 WHERE id = $2`, [entity.id, userId]);
  }

  // Seed the default UK Chart of Accounts for this entity
  try {
    await seedDefaultCOA(entity.id);
  } catch (_coaErr) {
    console.error('[COA] Failed to seed default chart of accounts:', _coaErr);
  }

  return entity;
}

export async function updateEntity(entityId: string, userId: string, data: {
  name?: string;
  businessStructure?: string;
  companyNumber?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  currency?: string;
  countryCode?: string;
  address?: string;
  logoUrl?: string;
  brandColor?: string;
  invoiceFooter?: string;
  phone?: string;
  website?: string;
}): Promise<Entity | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let p = 1;

  if (data.name !== undefined) { fields.push(`name = $${p++}`); values.push(data.name); }
  if (data.businessStructure !== undefined) { fields.push(`business_structure = $${p++}`); values.push(data.businessStructure); }
  if (data.companyNumber !== undefined) { fields.push(`company_number = $${p++}`); values.push(data.companyNumber); }
  if (data.vatRegistered !== undefined) { fields.push(`vat_registered = $${p++}`); values.push(data.vatRegistered); }
  if (data.vatNumber !== undefined) { fields.push(`vat_number = $${p++}`); values.push(data.vatNumber); }
  if (data.currency !== undefined) { fields.push(`currency = $${p++}`); values.push(data.currency); }
  if (data.countryCode !== undefined) { fields.push(`country_code = $${p++}`); values.push(data.countryCode); }
  if (data.address !== undefined) { fields.push(`address = $${p++}`); values.push(data.address); }
  if (data.logoUrl !== undefined) { fields.push(`logo_url = $${p++}`); values.push(data.logoUrl); }
  if (data.brandColor !== undefined) { fields.push(`brand_color = $${p++}`); values.push(data.brandColor); }
  if (data.invoiceFooter !== undefined) { fields.push(`invoice_footer = $${p++}`); values.push(data.invoiceFooter); }
  if (data.phone !== undefined) { fields.push(`phone = $${p++}`); values.push(data.phone); }
  if (data.website !== undefined) { fields.push(`website = $${p++}`); values.push(data.website); }

  if (fields.length === 0) return getEntityById(entityId, userId);

  fields.push(`updated_at = NOW()`);
  values.push(entityId, userId);

  const r = await query(
    `UPDATE entities SET ${fields.join(', ')} WHERE id = $${p} AND user_id = $${p + 1} RETURNING *`,
    values
  );
  return r.rows[0] as Entity || null;
}

export async function setActiveEntity(userId: string, entityId: string): Promise<boolean> {
  // Verify entity belongs to user
  const entity = await getEntityById(entityId, userId);
  if (!entity) return false;

  await query(`UPDATE users SET active_entity_id = $1 WHERE id = $2`, [entityId, userId]);
  return true;
}

export async function deleteEntity(entityId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const entity = await getEntityById(entityId, userId);
  if (!entity) return { success: false, error: 'Entity not found' };
  if (entity.is_default) return { success: false, error: 'Cannot delete default entity' };

  // Check for data
  const [invCount, custCount, billCount] = await Promise.all([
    query(`SELECT COUNT(*) as c FROM acc_invoices WHERE entity_id = $1`, [entityId]),
    query(`SELECT COUNT(*) as c FROM acc_customers WHERE entity_id = $1`, [entityId]),
    query(`SELECT COUNT(*) as c FROM acc_bills WHERE entity_id = $1`, [entityId]),
  ]);

  if (
    parseInt(invCount.rows[0].c) > 0 ||
    parseInt(custCount.rows[0].c) > 0 ||
    parseInt(billCount.rows[0].c) > 0
  ) {
    return { success: false, error: 'Cannot delete entity with existing data' };
  }

  await query(`DELETE FROM entities WHERE id = $1 AND user_id = $2`, [entityId, userId]);
  return { success: true };
}
