import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { canAccess } from '@/src/lib/tiers';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getProfitAndLoss } from '@/src/lib/general_ledger.service';
import { getPnLSummary, getPnLDetail } from '@/src/lib/report.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'real_time_reports')) {
      return NextResponse.json({ error: 'Upgrade to Sole Trader for reports' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    // Legacy summary/detail for dashboard stats
    const [summary, detail] = await Promise.all([
      getPnLSummary(auth.userId, { from, to, entityId: entity?.id }),
      getPnLDetail(auth.userId, { from, to, entityId: entity?.id }),
    ]);

    if (entity) {
      const now = new Date();
      const defaultFrom = from || `${now.getFullYear()}-01-01`;
      const defaultTo = to || now.toISOString().split('T')[0];
      const gl = await getProfitAndLoss(entity.id, defaultFrom, defaultTo);

      return NextResponse.json({
        // Legacy fields (backward compat for dashboard widgets)
        ...summary,
        ...detail,
        // GL-based breakdown (new — these override any same-named legacy fields)
        gl_income: gl.income,
        gl_cogs: gl.cogs,
        gl_expense: gl.expense,
        gl_totalIncome: gl.totalIncome,
        gl_totalCOGS: gl.totalCOGS,
        gl_grossProfit: gl.grossProfit,
        gl_totalExpense: gl.totalExpense,
        gl_netProfit: gl.netProfit,
      });
    }

    return NextResponse.json({ ...summary, ...detail });
  } catch (e) {
    console.error('P&L report error:', e);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
