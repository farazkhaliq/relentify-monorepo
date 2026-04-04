import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getConnections, syncTransactions } from '@/src/lib/openbanking.service';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { connectionId } = await req.json();

  try {
    if (connectionId) {
      const result = await syncTransactions(auth.userId, connectionId);
      return NextResponse.json({ success: true, ...result });
    }
    // Sync all connections
    const connections = await getConnections(auth.userId);
    let totalImported = 0;
    for (const conn of connections) {
      const r = await syncTransactions(auth.userId, conn.id);
      totalImported += r.imported;
    }
    return NextResponse.json({ success: true, imported: totalImported });
  } catch (e: unknown) {
    console.error('Sync error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const connections = await getConnections(auth.userId);
  return NextResponse.json({ connections });
}
