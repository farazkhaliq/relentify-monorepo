import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { query } from '@/lib/services/esign/db'

// List signing requests for the authenticated user, with optional CRM entity filters
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const relatedType = req.nextUrl.searchParams.get('related_type')
  const relatedId = req.nextUrl.searchParams.get('related_id')

  let sql = `SELECT id, token, title, signer_email, signer_name, status, expires_at, signed_at, created_at, related_type, related_id
             FROM esign_signing_requests
             WHERE created_by_user_id = $1`
  const params: any[] = [user.userId]

  if (relatedType) { sql += ` AND related_type = $${params.length + 1}`; params.push(relatedType) }
  if (relatedId) { sql += ` AND related_id = $${params.length + 1}`; params.push(relatedId) }

  sql += ' ORDER BY created_at DESC LIMIT 100'

  const { rows } = await query(sql, params)
  return NextResponse.json(rows)
}
