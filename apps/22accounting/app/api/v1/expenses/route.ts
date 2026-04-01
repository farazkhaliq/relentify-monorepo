import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, parseListParams } from '@/src/lib/v1-helpers';
import { getExpenses } from '@/src/lib/expense.service';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'expenses:read');
  if (scopeErr) return scopeErr;
  const { offset, limit, page } = parseListParams(req);
  const expenses = await getExpenses(ctx.userId);
  return apiSuccess(expenses.slice(offset, offset + limit), {
    pagination: { page, limit, total: expenses.length, hasMore: offset + limit < expenses.length },
    testMode: ctx.isTestMode,
  });
}
