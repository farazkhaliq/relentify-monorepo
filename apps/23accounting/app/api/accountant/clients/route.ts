import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getAccountantClients, getClientHealthStats } from '@/src/lib/accountant.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const clients = await getAccountantClients(auth.userId);

  const activeClientIds = clients
    .filter(c => c.status === 'active' && c.client_user_id)
    .map(c => c.client_user_id as string);

  const healthStats = await getClientHealthStats(activeClientIds);

  const result = clients.map(c => ({
    ...c,
    health: c.client_user_id ? (healthStats[c.client_user_id] ?? null) : null,
  }));

  return NextResponse.json(result);
}
