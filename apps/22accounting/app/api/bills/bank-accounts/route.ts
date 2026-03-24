import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getChartOfAccounts } from '@/src/lib/chart_of_accounts.service';

// Returns bank / cash accounts from COA (codes 1200–1299) for payment method selection
export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ accounts: [] });
    const all = await getChartOfAccounts(entity.id);
    const bankAccounts = all.filter(
      (a: { code: number; is_active: boolean }) => a.code >= 1200 && a.code <= 1299 && a.is_active
    );
    return NextResponse.json({ accounts: bankAccounts });
  } catch (e) {
    console.error('[bills/bank-accounts]', e);
    return NextResponse.json({ accounts: [] });
  }
}
