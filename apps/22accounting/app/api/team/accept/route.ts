import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { acceptInvite } from '@/src/lib/team.service';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'You must be logged in to accept an invitation' }, { status: 401 });
    const { token } = await req.json() as { token: string };
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
    const member = await acceptInvite(token, auth.actorId, auth.email);
    if (!member) return NextResponse.json({ error: 'Invalid or expired invitation, or email address does not match' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST /api/team/accept error:', e);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
