import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { getTrialBalance } from '@/src/lib/general_ledger.service';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'reports:read');
  if (scopeErr) return scopeErr;

  const asOf = req.nextUrl.searchParams.get('asOf') || undefined;

  try {
    const report = await getTrialBalance(ctx.entityId, asOf);
    return apiSuccess(report, { testMode: ctx.isTestMode });
  } catch (e) {
    console.error('v1 trial balance:', e);
    return apiError('internal_error', 'Failed to generate trial balance', 500);
  }
}
