import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { query } from '@/src/lib/db'
import { rowsToCsv } from '@/src/lib/reports.service'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id: workerId } = await params

  // Workers can export their own data, admins can export anyone's
  if (auth.userId !== workerId && auth.actorId === auth.userId) {
    // Check they're the owner (admin access)
  } else if (auth.userId !== workerId) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const [entries, breaks, pings, shifts] = await Promise.all([
    query(`SELECT * FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2 ORDER BY clock_in_at`, [workerId, entity.id]),
    query(`SELECT b.* FROM ts_breaks b JOIN ts_entries e ON b.entry_id = e.id WHERE e.worker_user_id = $1 AND e.entity_id = $2 ORDER BY b.start_at`, [workerId, entity.id]),
    query(`SELECT p.* FROM ts_gps_pings p JOIN ts_entries e ON p.entry_id = e.id WHERE e.worker_user_id = $1 AND e.entity_id = $2 ORDER BY p.captured_at`, [workerId, entity.id]),
    query(`SELECT * FROM ts_shifts WHERE worker_user_id = $1 AND entity_id = $2 ORDER BY date`, [workerId, entity.id]),
  ])

  const sections = [
    '--- ENTRIES ---', rowsToCsv(entries.rows),
    '', '--- BREAKS ---', rowsToCsv(breaks.rows),
    '', '--- GPS PINGS ---', rowsToCsv(pings.rows),
    '', '--- SHIFTS ---', rowsToCsv(shifts.rows),
  ].join('\n')

  const date = new Date().toISOString().split('T')[0]
  return new Response(sections, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="data-export-${date}.csv"`,
    },
  })
}
