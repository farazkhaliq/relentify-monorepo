import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getAllMaintenanceRequests } from '@/lib/services/crm.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests = await getAllMaintenanceRequests(auth.activeEntityId);
    return NextResponse.json(requests);
  } catch (error) {
    console.error('GET /api/maintenance error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
