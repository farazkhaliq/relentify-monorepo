import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAuditLogs } from '@/lib/services/audit-logs.service'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const logs = await getAuditLogs(auth.activeEntityId)
    return NextResponse.json(logs)
  } catch (error) {
    console.error('GET /api/audit-logs error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
