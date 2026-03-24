import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getEntitiesByUser, createEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entities = await getEntitiesByUser(auth.userId);
    return NextResponse.json({ entities });
  } catch (e) {
    console.error('GET entities error:', e);
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const denied = checkPermission(auth, 'settings', 'view');
    if (denied) return denied;

    const user = await getUserById(auth.userId);
    // Allow creating first entity for all tiers; additional entities require corporate
    const existing = await getEntitiesByUser(auth.userId);
    if (existing.length >= 1 && !canAccess(user?.tier, 'multi_entity')) {
      return NextResponse.json({ error: 'Upgrade to Corporate to manage multiple entities' }, { status: 403 });
    }

    const body = await req.json();
    const { name, businessStructure, companyNumber, vatRegistered, vatNumber, currency, countryCode, address } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Entity name is required' }, { status: 400 });

    const entity = await createEntity(auth.userId, {
      name: name.trim(),
      businessStructure,
      companyNumber,
      vatRegistered,
      vatNumber,
      currency,
      countryCode,
      address,
    });

    return NextResponse.json({ entity }, { status: 201 });
  } catch (e) {
    console.error('POST entities error:', e);
    return NextResponse.json({ error: 'Failed to create entity' }, { status: 500 });
  }
}
