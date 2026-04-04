import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getDashboardStats } from '@/src/lib/invoice.service';
import { getActiveEntity } from '@/src/lib/entity.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  return NextResponse.json({ stats: await getDashboardStats(auth.userId, entity?.id) });
}
