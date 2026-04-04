import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { checkPermission } from '@/src/lib/workspace-auth'
import { updateMemberPermissions } from '@/src/lib/team.service'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'team', 'manage')
  if (denied) return denied
  const { id } = await params
  const { permissions } = await req.json()
  if (!permissions) return NextResponse.json({ error: 'permissions required' }, { status: 400 })
  await updateMemberPermissions(id, auth.userId, permissions)
  return NextResponse.json({ success: true })
}
