import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getAllContacts } from '@/lib/services/crm.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contacts = await getAllContacts(auth.activeEntityId);
    return NextResponse.json(contacts);
  } catch (error) {
    console.error('GET /api/contacts error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
