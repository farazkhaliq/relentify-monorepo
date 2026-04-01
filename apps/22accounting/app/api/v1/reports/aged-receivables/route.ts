import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { query } from '@/src/lib/db';

export async function GET(req: NextRequest) {
  const result = await requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'reports:read');
  if (scopeErr) return scopeErr;

  try {
    const today = new Date().toISOString().split('T')[0];

    const r = await query(
      `SELECT
         i.id, i.invoice_number, i.client_name, i.due_date,
         i.total, i.currency,
         CURRENT_DATE - i.due_date::date AS days_overdue
       FROM invoices i
       WHERE i.user_id = $1 AND i.entity_id = $2
         AND i.status IN ('sent', 'overdue')
       ORDER BY i.due_date ASC`,
      [ctx.userId, ctx.entityId]
    );

    const rows = r.rows.map((row: {
      id: string; invoice_number: string; client_name: string;
      due_date: string; total: string; currency: string; days_overdue: number;
    }) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      clientName: row.client_name,
      dueDate: row.due_date,
      amount: parseFloat(row.total),
      currency: row.currency,
      daysOverdue: Math.max(0, Number(row.days_overdue)),
    }));

    const summary = {
      current: rows.filter(r => r.daysOverdue === 0),
      days30: rows.filter(r => r.daysOverdue > 0 && r.daysOverdue <= 30),
      days60: rows.filter(r => r.daysOverdue > 30 && r.daysOverdue <= 60),
      days90: rows.filter(r => r.daysOverdue > 60 && r.daysOverdue <= 90),
      over90: rows.filter(r => r.daysOverdue > 90),
    };

    return apiSuccess({ rows, summary, asOf: today }, { testMode: ctx.isTestMode });
  } catch (e) {
    console.error('v1 aged receivables:', e);
    return apiError('internal_error', 'Failed to generate aged receivables', 500);
  }
}
