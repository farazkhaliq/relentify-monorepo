import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError, parseListParams } from '@/src/lib/v1-helpers';
import { getProfitAndLoss } from '@/src/lib/general_ledger.service';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'reports:read');
  if (scopeErr) return scopeErr;

  const { from, to } = parseListParams(req);
  const now = new Date();
  const defaultFrom = from || `${now.getFullYear()}-01-01`;
  const defaultTo = to || now.toISOString().split('T')[0];

  try {
    const report = await getProfitAndLoss(ctx.entityId, defaultFrom, defaultTo);
    return apiSuccess(report, { testMode: ctx.isTestMode });
  } catch (e) {
    console.error('v1 P&L report:', e);
    return apiError('internal_error', 'Failed to generate P&L report', 500);
  }
}
