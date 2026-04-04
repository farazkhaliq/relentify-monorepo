import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getTrialBalance } from '@/src/lib/general_ledger.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const asOf = searchParams.get('asOf') || undefined;

    const result = await getTrialBalance(entity.id, asOf);
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET trial-balance error:', e);
    return NextResponse.json({ error: 'Failed to fetch trial balance' }, { status: 500 });
  }
}
