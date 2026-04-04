import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDashboardStats } from '@/lib/services/crm/crm.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getDashboardStats(auth.activeEntityId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('GET /api/reports/dashboard-stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
