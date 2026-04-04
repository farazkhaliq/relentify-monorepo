import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { createIntercompanyTransaction, getIntercompanyLinks } from '@/src/lib/intercompany.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const links = await getIntercompanyLinks(entity.id);
    return NextResponse.json({ links });
  } catch (e) {
    console.error('GET intercompany error:', e);
    return NextResponse.json({ error: 'Failed to fetch intercompany links' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'intercompany')) {
      return NextResponse.json({ error: 'Upgrade to Corporate for intercompany transactions' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { receivingEntityId, invoiceId } = await req.json();
    if (!receivingEntityId || !invoiceId) {
      return NextResponse.json({ error: 'receivingEntityId and invoiceId are required' }, { status: 400 });
    }

    const result = await createIntercompanyTransaction(entity.id, receivingEntityId, invoiceId, auth.userId);
    if (!result) return NextResponse.json({ error: 'Failed to create intercompany transaction' }, { status: 400 });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error('POST intercompany error:', e);
    return NextResponse.json({ error: 'Failed to create intercompany transaction' }, { status: 500 });
  }
}
