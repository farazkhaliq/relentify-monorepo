import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { attendanceReport, hoursReport, payrollSummary, rowsToCsv } from '@/src/lib/reports.service'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'reports', 'export')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'hours'
  const dateFrom = url.searchParams.get('dateFrom') || new Date(Date.now() - 30 * 86400000).toISOString()
  const dateTo = url.searchParams.get('dateTo') || new Date().toISOString()

  let rows: Record<string, unknown>[]
  if (type === 'attendance') rows = await attendanceReport(entity.user_id, entity.id, dateFrom, dateTo)
  else if (type === 'payroll') rows = await payrollSummary(entity.user_id, entity.id, dateFrom, dateTo)
  else rows = await hoursReport(entity.user_id, entity.id, dateFrom, dateTo)

  const csv = rowsToCsv(rows)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}-report-${dateFrom.split('T')[0]}.csv"`,
    },
  })
}
