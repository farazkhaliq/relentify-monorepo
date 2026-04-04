import { NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { getActiveEntry } from '@/src/lib/entry.service'
import { query } from '@/src/lib/db'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ entry: null, activeBreak: null })

  const entry = await getActiveEntry(auth.userId, entity.id)

  let activeBreak = null
  if (entry) {
    const breakResult = await query(
      `SELECT * FROM ts_breaks WHERE entry_id = $1 AND end_at IS NULL`,
      [entry.id]
    )
    activeBreak = breakResult.rows[0] || null
  }

  return NextResponse.json({ entry, activeBreak })
}
