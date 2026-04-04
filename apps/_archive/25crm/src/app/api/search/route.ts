import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ contacts: [], properties: [], tenancies: [] })

  const term = `%${q}%`
  const [contacts, properties, tenancies] = await Promise.all([
    pool.query(
      `SELECT id, first_name, last_name, email, contact_type FROM crm_contacts
       WHERE entity_id = $1 AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2) LIMIT 10`,
      [auth.activeEntityId, term]
    ),
    pool.query(
      `SELECT id, address_line1, city, postcode, status FROM crm_properties
       WHERE entity_id = $1 AND (address_line1 ILIKE $2 OR city ILIKE $2 OR postcode ILIKE $2) LIMIT 10`,
      [auth.activeEntityId, term]
    ),
    pool.query(
      `SELECT t.id, p.address_line1 as property_address, t.status FROM crm_tenancies t
       LEFT JOIN crm_properties p ON t.property_id = p.id
       WHERE t.entity_id = $1 AND p.address_line1 ILIKE $2 LIMIT 10`,
      [auth.activeEntityId, term]
    ),
  ])

  return NextResponse.json({
    contacts: contacts.rows,
    properties: properties.rows,
    tenancies: tenancies.rows,
  })
}
