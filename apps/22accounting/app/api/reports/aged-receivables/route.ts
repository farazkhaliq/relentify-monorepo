import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { query } from '@/src/lib/db';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

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
      [auth.userId, entity.id]
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
      current:    rows.filter(r => r.daysOverdue === 0),
      days30:     rows.filter(r => r.daysOverdue > 0 && r.daysOverdue <= 30),
      days60:     rows.filter(r => r.daysOverdue > 30 && r.daysOverdue <= 60),
      days90:     rows.filter(r => r.daysOverdue > 60 && r.daysOverdue <= 90),
      over90:     rows.filter(r => r.daysOverdue > 90),
    };

    return NextResponse.json({ rows, summary, asOf: today });
  } catch (e) {
    console.error('[aged-receivables]', e);
    return NextResponse.json({ error: 'Failed to fetch aged receivables' }, { status: 500 });
  }
}
