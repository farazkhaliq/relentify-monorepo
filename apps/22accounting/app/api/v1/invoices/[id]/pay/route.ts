import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { markInvoicePaidManually } from '@/src/lib/invoice.service';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:write');
  if (scopeErr) return scopeErr;

  const { id } = await params;

  if (ctx.isTestMode) {
    return apiSuccess({ id, status: 'paid', test: true }, { testMode: true });
  }

  try {
    let paymentDate: string | undefined;
    let amount: number | undefined;
    let bankAccountId: string | undefined;
    let reference: string | undefined;

    try {
      const body = await req.json();
      paymentDate = body.paymentDate || undefined;
      amount = body.amount ? parseFloat(body.amount) : undefined;
      bankAccountId = body.bankAccountId || undefined;
      reference = body.reference || undefined;
    } catch { /* body optional */ }

    const dateToCheck = paymentDate || new Date().toISOString().split('T')[0];
    const lockCheck = await isDateLocked(ctx.entityId, dateToCheck, ctx.userId);
    if (lockCheck.locked) {
      return apiError('period_locked', `Period locked through ${lockCheck.lockedThrough}`, 403);
    }

    const invoice = await markInvoicePaidManually(id, ctx.userId, ctx.entityId, {
      paymentDate, amount, bankAccountId, reference,
    });

    return apiSuccess(invoice);
  } catch (e) {
    console.error('v1 record payment:', e);
    const msg = e instanceof Error ? e.message : 'Failed to record payment';
    return apiError('internal_error', msg, 500);
  }
}
