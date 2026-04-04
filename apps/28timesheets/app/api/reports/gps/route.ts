import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'reports', 'view')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const url = new URL(req.url)
  const dateFrom = url.searchParams.get('dateFrom') || new Date(Date.now() - 30 * 86400000).toISOString()
  const dateTo = url.searchParams.get('dateTo') || new Date().toISOString()
  // Dynamic import to use the correct report function
  const { attendanceReport, hoursReport, wageLeakageReport } = await import('@/src/lib/reports.service')
  const reportType = url.pathname.split('/').pop()
  let data
  if (reportType === 'attendance') data = await attendanceReport(entity.user_id, entity.id, dateFrom, dateTo)
  else if (reportType === 'hours') data = await hoursReport(entity.user_id, entity.id, dateFrom, dateTo)
  else if (reportType === 'gps') data = await wageLeakageReport(entity.user_id, entity.id, dateFrom, dateTo)
  else data = await hoursReport(entity.user_id, entity.id, dateFrom, dateTo)
  return NextResponse.json({ data })
}
