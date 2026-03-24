import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { setActiveEntity, getEntityById } from '@/src/lib/entity.service';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id } = await params;
    const ok = await setActiveEntity(auth.userId, id);
    if (!ok) return NextResponse.json({ error: 'Entity not found or access denied' }, { status: 404 });
    const entity = await getEntityById(id, auth.userId);
    return NextResponse.json({ entity });
  } catch (e) {
    console.error('Activate entity error:', e);
    return NextResponse.json({ error: 'Failed to activate entity' }, { status: 500 });
  }
}
