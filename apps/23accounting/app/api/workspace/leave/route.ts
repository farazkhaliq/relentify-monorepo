import { NextResponse } from 'next/server';
import { getAuthUser, generateToken, setAuthCookie } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';

export async function POST() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const actor = await getUserById(auth.actorId);
    if (!actor) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const token = generateToken({
      userId: auth.actorId,
      actorId: auth.actorId,
      email: actor.email,
      fullName: actor.full_name,
      userType: actor.user_type,
    });

    const cookieHeader = setAuthCookie(token);
    return NextResponse.json({ left: true }, { headers: cookieHeader });
  } catch (e) {
    console.error('POST /api/workspace/leave error:', e);
    return NextResponse.json({ error: 'Failed to leave workspace' }, { status: 500 });
  }
}
