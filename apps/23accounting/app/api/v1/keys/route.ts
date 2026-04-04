import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { generateApiKey, listApiKeys, ALL_SCOPES } from '@/src/lib/api-key.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const keys = await listApiKeys(entity.id);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const body = await req.json();
  const { name, scopes, isTestMode, allowedIps, expiresAt } = body;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: 'scopes array is required' }, { status: 400 });
  }
  const invalid = scopes.filter((s: string) => !ALL_SCOPES.includes(s));
  if (invalid.length > 0) return NextResponse.json({ error: `Unknown scopes: ${invalid.join(', ')}` }, { status: 400 });
  const { rawKey, apiKey } = await generateApiKey({
    entityId: entity.id, userId: auth.userId,
    name, scopes, isTestMode, allowedIps, expiresAt,
  });
  // rawKey shown once -- include in creation response
  return NextResponse.json({ key: rawKey, apiKey }, { status: 201 });
}
