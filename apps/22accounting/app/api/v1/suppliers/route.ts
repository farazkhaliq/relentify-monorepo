import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError, parseListParams } from '@/src/lib/v1-helpers';
import { getAllSuppliers, createSupplier } from '@/src/lib/supplier.service';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'suppliers:read');
  if (scopeErr) return scopeErr;
  const { offset, limit, page } = parseListParams(req);
  const suppliers = await getAllSuppliers(ctx.userId, ctx.entityId);
  return apiSuccess(suppliers.slice(offset, offset + limit), {
    pagination: { page, limit, total: suppliers.length, hasMore: offset + limit < suppliers.length },
    testMode: ctx.isTestMode,
  });
}

export async function POST(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'suppliers:write');
  if (scopeErr) return scopeErr;
  const body = await req.json();
  if (!body.name) return apiError('validation_error', 'name is required', 400);
  if (ctx.isTestMode) return apiSuccess({ ...body, id: 'test_supplier_id' }, { status: 201, testMode: true });
  try {
    const supplier = await createSupplier({ userId: ctx.userId, entityId: ctx.entityId, ...body });
    return apiSuccess(supplier, { status: 201 });
  } catch (e) {
    console.error('v1 create supplier:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}
