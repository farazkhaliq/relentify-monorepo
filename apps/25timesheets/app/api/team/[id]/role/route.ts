import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { checkPermission } from '@/src/lib/workspace-auth'
import { updateMemberRole } from '@/src/lib/team.service'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'team', 'manage')
  if (denied) return denied
  const { id } = await params
  const { role } = await req.json()
  if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 })
  await updateMemberRole(id, auth.userId, role)
  return NextResponse.json({ success: true })
}
