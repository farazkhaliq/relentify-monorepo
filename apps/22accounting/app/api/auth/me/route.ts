import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const user = await getUserById(auth.userId);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    user,
    isWorkspaceMember: auth.actorId !== auth.userId,
    workspacePermissions: auth.workspacePermissions ?? null,
    actorId: auth.actorId,
    isAccountantAccess: auth.isAccountantAccess ?? false,
  });
}
