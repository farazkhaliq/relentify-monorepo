import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/services/inventory/db'
import { toInventory } from '@/lib/services/inventory/types'

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { rows } = await query(
    'SELECT property_address, type, created_by, created_at, tenant_confirmed FROM inv_items WHERE confirm_token=$1',
    [token]
  )
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = rows[0]
  return NextResponse.json({
    propertyAddress: row.property_address,
    type: row.type,
    createdBy: row.created_by,
    createdAt: row.created_at,
    tenantConfirmed: row.tenant_confirmed,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'

  const { rows } = await query('SELECT id, tenant_confirmed FROM inv_items WHERE confirm_token=$1', [token])
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rows[0].tenant_confirmed) return NextResponse.json({ error: 'Already confirmed' }, { status: 409 })

  await query(
    'UPDATE inv_items SET tenant_confirmed=TRUE, confirmed_at=NOW(), confirmed_ip=$1 WHERE confirm_token=$2',
    [ip, token]
  )
  return NextResponse.json({ success: true })
}
