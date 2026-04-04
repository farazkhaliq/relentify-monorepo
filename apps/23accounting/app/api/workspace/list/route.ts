import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getWorkspacesForMember } from '@/src/lib/team.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  // Use actorId so this works even when already inside a shared workspace
  const workspaces = await getWorkspacesForMember(auth.actorId);
  return NextResponse.json({ workspaces });
}
