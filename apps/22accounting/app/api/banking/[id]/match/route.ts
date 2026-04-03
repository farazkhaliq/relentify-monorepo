import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { manualMatch, ignoreTransaction, type MatchAction } from '@/src/lib/banking.service';
import { checkPermission } from '@/src/lib/workspace-auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { detectBankMismatch } from '@/src/lib/mismatch.service';
import { query } from '@/src/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'banking', 'reconcile');
    if (denied) return denied;

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

    // Detect bank-invoice or bank-bill amount mismatches (async, non-blocking)
    const entityId = (await getActiveEntity(auth.userId))?.id;
    if (entityId) {
      const txRow = (await query('SELECT amount FROM acc_bank_transactions WHERE id=$1', [id])).rows[0];
      if (txRow) {
        const txAmount = Math.abs(Number(txRow.amount));
        if (type === 'invoice_match' && invoiceId) {
          const inv = (await query('SELECT total FROM acc_invoices WHERE id=$1', [invoiceId])).rows[0];
          if (inv) detectBankMismatch(auth.userId, entityId, id, txAmount, 'invoice', invoiceId, Number(inv.total)).catch(() => {});
        } else if (type === 'bill_match' && billId) {
          const bill = (await query('SELECT amount FROM acc_bills WHERE id=$1', [billId])).rows[0];
          if (bill) detectBankMismatch(auth.userId, entityId, id, txAmount, 'bill', billId, Number(bill.amount)).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Match error:', e);
    return NextResponse.json({ error: 'Failed to match transaction' }, { status: 500 });
  }
}
