import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { inviteMember, getMembersByOwner } from '@/src/lib/team.service';
import { DEFAULT_PERMISSIONS } from '@/src/lib/team-defaults';
import { sendTeamInviteEmail } from '@/src/lib/email';
import { WorkspacePermissions } from '@/src/lib/auth';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const members = await getMembersByOwner(auth.userId);
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'granular_permissions')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to invite team members' }, { status: 403 });
    }

    const body = await req.json();
    const { email, permissions } = body as { email: string; permissions?: WorkspacePermissions };
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
    }

    const member = await inviteMember(auth.userId, email, permissions ?? DEFAULT_PERMISSIONS);

    const inviteUrl = `https://accounts.relentify.com/dashboard/team/accept?token=${member.invite_token}`;
    await sendTeamInviteEmail({
      to: email,
      inviterName: user?.full_name || user?.business_name || 'Your team',
      workspaceName: user?.business_name || user?.full_name || 'Relentify',
      inviteUrl,
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    console.error('POST /api/team error:', e);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}
