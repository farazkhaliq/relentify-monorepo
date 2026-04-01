import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { convertQuoteToInvoice } from '@/src/lib/quote.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'quotes', 'create');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const invoice = await convertQuoteToInvoice(id, auth.userId, entity.id);
    return NextResponse.json({ invoice });
  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'Failed to convert';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
