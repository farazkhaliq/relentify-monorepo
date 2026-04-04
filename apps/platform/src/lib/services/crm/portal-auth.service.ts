import pool from '../../pool'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-dev-secret'
)
const PORTAL_COOKIE = 'crm_portal_token'

export { PORTAL_COOKIE }

export interface PortalUser {
  id: string
  entity_id: string
  contact_id: string | null
  email: string
  full_name: string
  role: 'Tenant' | 'Landlord'
  is_active: boolean
}

export async function loginPortalUser(
  email: string,
  password: string
): Promise<{ user: PortalUser; token: string } | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_portal_users WHERE email = $1 AND is_active = true',
    [email]
  )
  const user = rows[0]
  if (!user) return null

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return null

  const token = await new SignJWT({
    portalUserId: user.id,
    entityId: user.entity_id,
    contactId: user.contact_id,
    role: user.role,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  await pool.query(
    'UPDATE crm_portal_users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  )

  return {
    user: {
      id: user.id,
      entity_id: user.entity_id,
      contact_id: user.contact_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    },
    token,
  }
}

export async function signupPortalUser(data: {
  email: string
  password: string
  fullName: string
  role: 'Tenant' | 'Landlord'
  entityId: string
}): Promise<{ user: PortalUser; token: string }> {
  // Check if a portal user already exists for this email + entity
  const { rows: existing } = await pool.query(
    'SELECT id FROM crm_portal_users WHERE email = $1 AND entity_id = $2',
    [data.email, data.entityId]
  )
  if (existing.length > 0) {
    throw new Error('A portal account already exists for this email.')
  }

  // Look up existing contact by email in this entity
  const { rows: contactRows } = await pool.query(
    'SELECT id FROM crm_contacts WHERE email = $1 AND entity_id = $2 LIMIT 1',
    [data.email, data.entityId]
  )
  const contactId = contactRows[0]?.id || null

  const passwordHash = await bcrypt.hash(data.password, 12)

  const { rows } = await pool.query(
    `INSERT INTO crm_portal_users (entity_id, contact_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.entityId, contactId, data.email, passwordHash, data.fullName, data.role]
  )
  const user = rows[0]

  const token = await new SignJWT({
    portalUserId: user.id,
    entityId: user.entity_id,
    contactId: user.contact_id,
    role: user.role,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  return {
    user: {
      id: user.id,
      entity_id: user.entity_id,
      contact_id: user.contact_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    },
    token,
  }
}

export async function verifyPortalToken(
  token: string
): Promise<any | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload
  } catch {
    return null
  }
}

export async function getPortalUser(
  portalUserId: string
): Promise<PortalUser | null> {
  const { rows } = await pool.query(
    'SELECT id, entity_id, contact_id, email, full_name, role, is_active FROM crm_portal_users WHERE id = $1 AND is_active = true',
    [portalUserId]
  )
  return rows[0] || null
}
