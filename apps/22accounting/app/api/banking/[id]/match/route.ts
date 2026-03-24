import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { manualMatch, ignoreTransaction, type MatchAction } from '@/src/lib/banking.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, type, invoiceId, billId, poaName, category } = body;

    if (action === 'ignore') {
      await ignoreTransaction(auth.userId, id);
      return NextResponse.json({ success: true });
    }

    let matchAction: MatchAction;
    if (type === 'invoice_match' && invoiceId) {
      matchAction = { type: 'invoice_match', invoiceId };
    } else if (type === 'bill_match' && billId) {
      matchAction = { type: 'bill_match', billId };
    } else if (type === 'payment_on_account' && poaName) {
      matchAction = { type: 'payment_on_account', poaName };
    } else if (type === 'bank_entry' && category) {
      matchAction = { type: 'bank_entry', category };
    } else {
      return NextResponse.json({ error: 'Invalid match parameters' }, { status: 400 });
    }

    const result = await manualMatch(auth.userId, id, matchAction);
    if (!result) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Match error:', e);
    return NextResponse.json({ error: 'Failed to match transaction' }, { status: 500 });
  }
}
