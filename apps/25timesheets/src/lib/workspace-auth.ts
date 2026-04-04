import { JWTPayload, TimesheetPermissions } from './auth'
import { NextResponse } from 'next/server'

type Module = keyof TimesheetPermissions

export function checkPermission(
  auth: JWTPayload,
  module: Module,
  action: string
): NextResponse | null {
  // Owner always allowed
  if (auth.actorId === auth.userId) return null
  const allowed = (auth.workspacePermissions as unknown as Record<string, Record<string, boolean>>)?.[module]?.[action]
  if (!allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  return null
}
