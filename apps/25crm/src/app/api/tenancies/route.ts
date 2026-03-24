import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getAllTenancies } from '@/lib/services/crm.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenancies = await getAllTenancies(auth.activeEntityId);
    return NextResponse.json(tenancies);
  } catch (error) {
    console.error('GET /api/tenancies error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
