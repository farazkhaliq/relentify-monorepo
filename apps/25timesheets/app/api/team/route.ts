import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { checkPermission } from '@/src/lib/workspace-auth'
import { listMembers, inviteMember } from '@/src/lib/team.service'
import { z } from 'zod'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const members = await listMembers(auth.userId)
  return NextResponse.json({ members })
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'staff', 'viewer']),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'team', 'manage')
  if (denied) return denied
  const body = await req.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const result = await inviteMember(auth.userId, parsed.data.email, parsed.data.role)
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 })
  }
}
