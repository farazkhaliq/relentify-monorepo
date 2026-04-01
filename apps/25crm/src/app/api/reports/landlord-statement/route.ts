import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const landlordId = req.nextUrl.searchParams.get('landlord_id')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  if (!landlordId) {
    return NextResponse.json({ error: 'Missing landlord_id parameter' }, { status: 400 })
  }
  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from/to date parameters' }, { status: 400 })
  }

  try {
    // Find properties linked to this landlord via tenancy_contacts with role 'Landlord'
    const { rows: landlordProperties } = await pool.query(
      `SELECT DISTINCT t.property_id AS id
       FROM crm_tenancy_contacts tc
       JOIN crm_tenancies t ON tc.tenancy_id = t.id
       WHERE tc.contact_id = $1 AND tc.role = 'Landlord' AND t.entity_id = $2
       AND t.property_id IS NOT NULL`,
      [landlordId, auth.activeEntityId]
    )
    const propertyIds = landlordProperties.map((p: any) => p.id)

    // Get transactions related to the landlord or their properties
    let transactions: any[] = []
    if (propertyIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT id, type, amount, currency, description, transaction_date
         FROM crm_transactions
         WHERE entity_id = $1
           AND transaction_date >= $2
           AND transaction_date <= $3
           AND (
             (type = 'Landlord Payout' AND payee_contact_id = $4)
             OR (related_property_id = ANY($5) AND type IN ('Rent Payment', 'Management Fee', 'Contractor Payment'))
           )
         ORDER BY transaction_date ASC`,
        [auth.activeEntityId, from, to, landlordId, propertyIds]
      )
      transactions = rows
    } else {
      // Still check for direct landlord payouts even if no properties found
      const { rows } = await pool.query(
        `SELECT id, type, amount, currency, description, transaction_date
         FROM crm_transactions
         WHERE entity_id = $1
           AND transaction_date >= $2
           AND transaction_date <= $3
           AND type = 'Landlord Payout'
           AND payee_contact_id = $4
         ORDER BY transaction_date ASC`,
        [auth.activeEntityId, from, to, landlordId]
      )
      transactions = rows
    }

    const income = transactions
      .filter((t: any) => t.type === 'Rent Payment')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

    const expenses = transactions
      .filter((t: any) => ['Management Fee', 'Contractor Payment'].includes(t.type))
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

    const payouts = transactions
      .filter((t: any) => t.type === 'Landlord Payout')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

    return NextResponse.json({
      transactions,
      income,
      expenses,
      payouts,
      net: income - expenses - payouts,
    })
  } catch (error) {
    console.error('GET /api/reports/landlord-statement error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
