import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getJournalEntries } from '@/src/lib/general_ledger.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const sourceType = searchParams.get('sourceType') || undefined;
    const accountCodeParam = searchParams.get('accountCode');
    const accountCode = accountCodeParam ? parseInt(accountCodeParam) : undefined;

    const entries = await getJournalEntries(entity.id, { from, to, sourceType, accountCode });
    return NextResponse.json({ entries });
  } catch (e) {
    console.error('GET ledger error:', e);
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}
