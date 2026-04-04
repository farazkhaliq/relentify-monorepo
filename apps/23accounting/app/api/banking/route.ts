import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getTransactions, importTransactions, type CsvRow } from '@/src/lib/banking.service';
import { canAccess } from '@/src/lib/tiers';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'banking', 'view');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const transactions = await getTransactions(auth.userId, { status, entityId: entity?.id });
    return NextResponse.json({ transactions });
  } catch (e) {
    console.error('GET banking error:', e);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'bank_reconciliation')) {
      return NextResponse.json({ error: 'Upgrade to Sole Trader for bank reconciliation' }, { status: 403 });
    }

    const body = await req.json();
    const { rows }: { rows: CsvRow[] } = body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const entity = await getActiveEntity(auth.userId);
    const imported = await importTransactions(auth.userId, rows, entity?.id);
    return NextResponse.json({ imported: imported.length });
  } catch (e) {
    console.error('POST banking error:', e);
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 });
  }
}
