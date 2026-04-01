import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError, parseListParams } from '@/src/lib/v1-helpers';
import { getAllCustomers, createCustomer } from '@/src/lib/customer.service';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'customers:read');
  if (scopeErr) return scopeErr;
  const { offset, limit, page } = parseListParams(req);
  const customers = await getAllCustomers(ctx.userId, ctx.entityId);
  return apiSuccess(customers.slice(offset, offset + limit), {
    pagination: { page, limit, total: customers.length, hasMore: offset + limit < customers.length },
    testMode: ctx.isTestMode,
  });
}

export async function POST(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'customers:write');
  if (scopeErr) return scopeErr;
  const body = await req.json();
  if (!body.name) return apiError('validation_error', 'name is required', 400);
  if (ctx.isTestMode) return apiSuccess({ ...body, id: 'test_customer_id' }, { status: 201, testMode: true });
  try {
    const customer = await createCustomer({ userId: ctx.userId, entityId: ctx.entityId, ...body });
    return apiSuccess(customer, { status: 201 });
  } catch (e) {
    console.error('v1 create customer:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}
