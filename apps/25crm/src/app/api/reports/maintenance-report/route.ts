import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get summary grouped by status and priority
    const { rows: summary } = await pool.query(
      `SELECT status, priority, COUNT(*)::int AS count
       FROM crm_maintenance_requests
       WHERE entity_id = $1 AND status NOT IN ('Completed', 'Cancelled')
       GROUP BY status, priority`,
      [auth.activeEntityId]
    )

    // Get individual open requests with property address
    const { rows: requests } = await pool.query(
      `SELECT m.id, m.property_id, m.title, m.description, m.priority, m.status,
              m.created_at AS reported_date,
              p.address_line1 AS property_address
       FROM crm_maintenance_requests m
       LEFT JOIN crm_properties p ON m.property_id = p.id
       WHERE m.entity_id = $1 AND m.status NOT IN ('Completed', 'Cancelled')
       ORDER BY m.created_at DESC`,
      [auth.activeEntityId]
    )

    // Build chart data: group by title/issue type
    const typeCounts: Record<string, number> = {}
    for (const req of requests) {
      const type = req.title || 'Other'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    }
    const chartData = Object.entries(typeCounts).map(([type, count]) => ({ type, count }))

    return NextResponse.json({ summary, requests, chartData })
  } catch (error) {
    console.error('GET /api/reports/maintenance-report error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
