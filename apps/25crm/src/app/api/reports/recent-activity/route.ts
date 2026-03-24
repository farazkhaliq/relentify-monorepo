import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getRecentActivity } from '@/lib/services/crm.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activity = await getRecentActivity(auth.activeEntityId);
    return NextResponse.json(activity);
  } catch (error) {
    console.error('GET /api/reports/recent-activity error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
