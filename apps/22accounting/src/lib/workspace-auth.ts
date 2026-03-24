import { JWTPayload, WorkspacePermissions } from './auth';
import { NextResponse } from 'next/server';

type Module = keyof WorkspacePermissions;

export function checkPermission(
  auth: JWTPayload,
  module: Module,
  action: string
): NextResponse | null {
  if (auth.actorId === auth.userId) return null;           // owner, always allowed
  if (auth.isAccountantAccess === true) return null;       // accountant, full access
  const allowed = (auth.workspacePermissions as unknown as Record<string, Record<string, boolean>>)?.[module]?.[action];
  if (!allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  return null;
}
