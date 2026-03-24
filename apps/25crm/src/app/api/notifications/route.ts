import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getNotifications } from '@/lib/services/crm.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const notifications = await getNotifications(auth.userId);
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
