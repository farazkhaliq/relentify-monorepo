import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.property_id, t.rent_amount, t.status,
              p.address_line1 AS property_address,
              COALESCE(
                (SELECT json_agg(json_build_object('id', c.id, 'name', c.first_name || ' ' || c.last_name))
                 FROM crm_tenancy_tenants tt
                 JOIN crm_contacts c ON tt.contact_id = c.id
                 WHERE tt.tenancy_id = t.id),
                '[]'::json
              ) AS tenants
       FROM crm_tenancies t
       LEFT JOIN crm_properties p ON t.property_id = p.id
       WHERE t.entity_id = $1 AND t.status = 'Arrears'
       ORDER BY t.created_at DESC`,
      [auth.activeEntityId]
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/reports/arrears error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
