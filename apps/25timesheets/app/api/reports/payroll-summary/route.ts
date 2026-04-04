import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { payrollSummary } from '@/src/lib/reports.service'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'reports', 'view')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const url = new URL(req.url)
  const periodStart = url.searchParams.get('periodStart') || new Date(Date.now() - 30 * 86400000).toISOString()
  const periodEnd = url.searchParams.get('periodEnd') || new Date().toISOString()
  const data = await payrollSummary(entity.user_id, entity.id, periodStart, periodEnd)
  return NextResponse.json({ payroll: data })
}
