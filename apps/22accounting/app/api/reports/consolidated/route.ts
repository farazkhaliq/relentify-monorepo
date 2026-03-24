import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { getConsolidatedPnL, getConsolidatedBalanceSheet } from '@/src/lib/consolidated.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'consolidated_dashboard')) {
      return NextResponse.json({ error: 'Upgrade to Corporate for consolidated reports' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    const [pnl, balanceSheet] = await Promise.all([
      getConsolidatedPnL(auth.userId, { from, to }),
      getConsolidatedBalanceSheet(auth.userId),
    ]);

    return NextResponse.json({ pnl, balanceSheet });
  } catch (e) {
    console.error('Consolidated report error:', e);
    return NextResponse.json({ error: 'Failed to generate consolidated report' }, { status: 500 });
  }
}
