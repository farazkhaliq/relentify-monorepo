import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { listWebhookEndpoints, createWebhookEndpoint, ALL_WEBHOOK_EVENTS } from '@/src/lib/webhook.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const endpoints = await listWebhookEndpoints(entity.id);
  return NextResponse.json({ endpoints });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const { url, events } = await req.json();
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
  const invalid = (events ?? []).filter((e: string) => !ALL_WEBHOOK_EVENTS.includes(e));
  if (invalid.length > 0) return NextResponse.json({ error: `Unknown events: ${invalid.join(', ')}` }, { status: 400 });
  const { secret, endpoint } = await createWebhookEndpoint({ entityId: entity.id, url, events });
  return NextResponse.json({ secret, endpoint }, { status: 201 });
}
