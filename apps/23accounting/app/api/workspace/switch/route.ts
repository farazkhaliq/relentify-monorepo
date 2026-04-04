import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, generateToken, setAuthCookie } from '@/src/lib/auth';
import { getActiveMembership } from '@/src/lib/team.service';
import { getUserById } from '@/src/lib/user.service';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { ownerUserId } = await req.json() as { ownerUserId: string };
    if (!ownerUserId) return NextResponse.json({ error: 'ownerUserId required' }, { status: 400 });

    const membership = await getActiveMembership(ownerUserId, auth.actorId);
    if (!membership) return NextResponse.json({ error: 'No active membership for this workspace' }, { status: 403 });

    const owner = await getUserById(ownerUserId);
    if (!owner) return NextResponse.json({ error: 'Workspace owner not found' }, { status: 404 });

    const token = generateToken({
      userId: ownerUserId,
      actorId: auth.actorId,
      email: owner.email,
      fullName: owner.full_name,
      userType: owner.user_type,
      workspacePermissions: membership.permissions,
    });

    const cookieHeader = setAuthCookie(token);
    return NextResponse.json({ switched: true }, { headers: cookieHeader });
  } catch (e) {
    console.error('POST /api/workspace/switch error:', e);
    return NextResponse.json({ error: 'Failed to switch workspace' }, { status: 500 });
  }
}
