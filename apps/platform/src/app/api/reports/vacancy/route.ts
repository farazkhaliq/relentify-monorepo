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
      `SELECT id, address_line1, city, postcode, property_type, rent_amount, created_at
       FROM crm_properties
       WHERE entity_id = $1 AND status = 'Available'
       ORDER BY created_at DESC`,
      [auth.activeEntityId]
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/reports/vacancy error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
