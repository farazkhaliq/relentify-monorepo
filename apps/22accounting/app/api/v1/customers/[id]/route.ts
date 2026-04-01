import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { getCustomerById, updateCustomer, deleteCustomer } from '@/src/lib/customer.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'customers:read');
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const customer = await getCustomerById(id, ctx.userId, ctx.entityId);
  if (!customer) return apiError('not_found', 'Customer not found', 404);
  return apiSuccess(customer, { testMode: ctx.isTestMode });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'customers:write');
  if (scopeErr) return scopeErr;
  const { id } = await params;
  if (ctx.isTestMode) return apiSuccess({ id, updated: true, test: true }, { testMode: true });
  try {
    const body = await req.json();
    const updated = await updateCustomer(id, ctx.userId, body, ctx.entityId);
    if (!updated) return apiError('not_found', 'Customer not found', 404);
    return apiSuccess(updated);
  } catch (e) {
    console.error('v1 update customer:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'customers:write');
  if (scopeErr) return scopeErr;
  const { id } = await params;
  if (ctx.isTestMode) return apiSuccess({ id, deleted: true, test: true }, { testMode: true });
  try {
    await deleteCustomer(id, ctx.userId, ctx.entityId);
    return apiSuccess({ deleted: true });
  } catch (e) {
    console.error('v1 delete customer:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}
