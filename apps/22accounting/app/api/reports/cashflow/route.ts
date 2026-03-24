import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getCashFlowForecast } from '@/src/lib/cashflow.service';
import { getActiveEntity } from '@/src/lib/entity.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const entity = await getActiveEntity(auth.userId);
    const data = await getCashFlowForecast(auth.userId, 90, entity?.id);
    return NextResponse.json(data);
  } catch (e) {
    console.error('Cash flow error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
