import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { revokeApiKey, rotateApiKey } from '@/src/lib/api-key.service';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const { id } = await params;
  const ok = await revokeApiKey(id, entity.id);
  if (!ok) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ revoked: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // POST /api/v1/keys/:id -- rotate
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const { id } = await params;
  const result = await rotateApiKey(id, entity.id);
  if (!result) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ key: result.rawKey, apiKey: result.newKey }, { status: 200 });
}
