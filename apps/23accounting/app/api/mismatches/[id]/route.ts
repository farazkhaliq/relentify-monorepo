import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { resolveMismatch } from '@/src/lib/mismatch.service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'mismatch_flagging')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const action = body.action;
    if (action !== 'resolved' && action !== 'ignored') {
      return NextResponse.json({ error: 'action must be "resolved" or "ignored"' }, { status: 400 });
    }

    const updated = await resolveMismatch(id, auth.userId, action);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ mismatch: updated });
  } catch (err) {
    console.error('PATCH /api/mismatches/[id] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
