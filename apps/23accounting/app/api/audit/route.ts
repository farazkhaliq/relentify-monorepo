import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getAuditLog } from '@/src/lib/audit.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const log = await getAuditLog(auth.userId, undefined, 200);
  return NextResponse.json({ log });
}
