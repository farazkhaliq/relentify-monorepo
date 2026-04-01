import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError, parseListParams } from '@/src/lib/v1-helpers';
import { getAllBills, createBill } from '@/src/lib/bill.service';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'bills:read');
  if (scopeErr) return scopeErr;
  const { offset, limit, page } = parseListParams(req);
  const bills = await getAllBills(ctx.userId, ctx.entityId);
  return apiSuccess(bills.slice(offset, offset + limit), {
    pagination: { page, limit, total: bills.length, hasMore: offset + limit < bills.length },
    testMode: ctx.isTestMode,
  });
}

export async function POST(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'bills:write');
  if (scopeErr) return scopeErr;
  const body = await req.json();
  if (ctx.isTestMode) return apiSuccess({ ...body, id: 'test_bill_id' }, { status: 201, testMode: true });
  try {
    const bill = await createBill(ctx.userId, { entityId: ctx.entityId, ...body });
    return apiSuccess(bill, { status: 201 });
  } catch (e) {
    console.error('v1 create bill:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}
