import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getEntityById, updateEntity, deleteEntity } from '@/src/lib/entity.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id } = await params;
    const entity = await getEntityById(id, auth.userId);
    if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ entity });
  } catch (e) {
    console.error('GET entity error:', e);
    return NextResponse.json({ error: 'Failed to fetch entity' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const entity = await updateEntity(id, auth.userId, body);
    if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ entity });
  } catch (e) {
    console.error('PATCH entity error:', e);
    return NextResponse.json({ error: 'Failed to update entity' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id } = await params;
    const result = await deleteEntity(id, auth.userId);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE entity error:', e);
    return NextResponse.json({ error: 'Failed to delete entity' }, { status: 500 });
  }
}
