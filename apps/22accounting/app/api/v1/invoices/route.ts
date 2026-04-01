import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError, parseListParams } from '@/src/lib/v1-helpers';
import { createInvoice, getInvoicesByUser } from '@/src/lib/invoice.service';
import { invoiceSchema } from '@/src/lib/validation';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:read');
  if (scopeErr) return scopeErr;

  const { offset, limit } = parseListParams(req);
  const invoices = await getInvoicesByUser(ctx.userId, ctx.entityId);
  const page = Math.floor(offset / limit) + 1;
  const sliced = invoices.slice(offset, offset + limit);

  return apiSuccess(sliced, {
    pagination: { page, limit, total: invoices.length, hasMore: offset + limit < invoices.length },
    testMode: ctx.isTestMode,
  });
}

export async function POST(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:write');
  if (scopeErr) return scopeErr;

  const parsed = invoiceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError('validation_error', parsed.error.errors[0].message, 400);
  }

  if (ctx.isTestMode) {
    // Sandbox: validate only, don't write
    return apiSuccess({ ...parsed.data, id: 'test_invoice_id', invoice_number: 'INV-TEST-0001' }, { status: 201, testMode: true });
  }

  const { customerId, projectId, ...invoiceData } = parsed.data;
  try {
    const invoice = await createInvoice({ userId: ctx.userId, entityId: ctx.entityId, customerId, projectId, ...invoiceData });
    return apiSuccess(invoice, { status: 201 });
  } catch (e) {
    console.error('v1 create invoice:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}
