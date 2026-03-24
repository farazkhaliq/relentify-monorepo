import pool from '../db';

export interface Property {
  id: string;
  entity_id: string;
  user_id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  property_type?: string;
  rent_amount: number;
  status: string;
  image_url?: string;
  image_hint?: string;
  notes?: string;
  number_of_bedrooms: number;
  number_of_bathrooms: number;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export async function getAllProperties(entityId: string): Promise<Property[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_properties WHERE entity_id = $1 ORDER BY created_at DESC',
    [entityId]
  );
  return rows;
}

export async function getPropertyById(id: string, entityId: string): Promise<Property | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_properties WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  );
  return rows[0] || null;
}

export async function createProperty(property: Partial<Property>): Promise<Property> {
  const {
    entity_id,
    user_id,
    address_line1,
    address_line2,
    city,
    postcode,
    property_type,
    rent_amount,
    status,
    image_url,
    image_hint,
    notes,
    number_of_bedrooms,
    number_of_bathrooms,
    description
  } = property;

  const { rows } = await pool.query(
    `INSERT INTO crm_properties (
      entity_id, user_id, address_line1, address_line2, city, postcode, 
      property_type, rent_amount, status, image_url, image_hint, notes,
      number_of_bedrooms, number_of_bathrooms, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      entity_id, user_id, address_line1, address_line2, city, postcode, 
      property_type, rent_amount, status, image_url, image_hint, notes,
      number_of_bedrooms, number_of_bathrooms, description
    ]
  );
  return rows[0];
}

export async function updateProperty(id: string, entityId: string, updates: Partial<Property>): Promise<Property | null> {
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'entity_id' && k !== 'user_id');
  if (fields.length === 0) return getPropertyById(id, entityId);

  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => (updates as any)[f]);

  const { rows } = await pool.query(
    `UPDATE crm_properties SET ${setClause} WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  );
  return rows[0] || null;
}

export async function deleteProperty(id: string, entityId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_properties WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  );
  return rowCount !== null && rowCount > 0;
}
