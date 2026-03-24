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
         b.id, b.supplier_name, b.due_date,
         b.amount, b.currency,
         CURRENT_DATE - b.due_date::date AS days_overdue
       FROM bills b
       WHERE b.user_id = $1 AND b.entity_id = $2
         AND b.status IN ('unpaid', 'overdue')
       ORDER BY b.due_date ASC`,
      [auth.userId, entity.id]
    );

    const rows = r.rows.map((row: {
      id: string; supplier_name: string; due_date: string;
      amount: string; currency: string; days_overdue: number;
    }) => ({
      id: row.id,
      supplierName: row.supplier_name,
      dueDate: row.due_date,
      amount: parseFloat(row.amount),
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
    console.error('[aged-payables]', e);
    return NextResponse.json({ error: 'Failed to fetch aged payables' }, { status: 500 });
  }
}
