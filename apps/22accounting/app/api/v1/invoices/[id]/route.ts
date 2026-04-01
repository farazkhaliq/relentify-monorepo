import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { getInvoiceById } from '@/src/lib/invoice.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:read');
  if (scopeErr) return scopeErr;

  const { id } = await params;
  const invoice = await getInvoiceById(id, ctx.userId);
  if (!invoice) return apiError('not_found', 'Invoice not found', 404);

  return apiSuccess(invoice, { testMode: ctx.isTestMode });
}
