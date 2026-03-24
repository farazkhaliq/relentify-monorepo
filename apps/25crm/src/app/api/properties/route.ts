import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getAllProperties } from '@/lib/services/crm.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const properties = await getAllProperties(auth.activeEntityId);
    return NextResponse.json(properties);
  } catch (error) {
    console.error('GET /api/properties error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
