import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/src/lib/db';
import { sendReminderEmail } from '@/src/lib/email';
import { startCronRun, finishCronRun } from '@/src/lib/cron-monitor.service';

type TriggerType = '3_days_before' | 'due_date' | '7_days_after';

function getTriggerDate(dueDate: string, trigger: TriggerType): string {
  const d = new Date(dueDate);
  if (trigger === '3_days_before') d.setDate(d.getDate() - 3);
  else if (trigger === '7_days_after') d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = await startCronRun('reminders');
  const today = new Date().toISOString().split('T')[0];
  const triggers: TriggerType[] = ['3_days_before', 'due_date', '7_days_after'];
  let sent = 0;
  let skipped = 0;

  try {
    const invoices = await query(
      `SELECT i.id, i.invoice_number, i.client_name, i.client_email,
              i.total, i.currency, i.due_date, i.stripe_payment_link,
              u.full_name, u.business_name, u.payment_reminders_enabled
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       WHERE i.status IN ('sent','overdue')
         AND i.client_email IS NOT NULL
         AND u.payment_reminders_enabled = true`,
      []
    );

    for (const inv of invoices.rows) {
      for (const trigger of triggers) {
        const triggerDate = getTriggerDate(inv.due_date, trigger);
        if (triggerDate !== today) continue;

        const already = await query(
          `SELECT id FROM reminder_logs WHERE invoice_id=$1 AND trigger_type=$2`,
          [inv.id, trigger]
        );
        if (already.rows.length > 0) { skipped++; continue; }

        const result = await sendReminderEmail(
          {
            to: inv.client_email,
            invoiceNumber: inv.invoice_number,
            clientName: inv.client_name,
            total: inv.total,
            currency: inv.currency,
            dueDate: inv.due_date,
            paymentLink: inv.stripe_payment_link || null,
            businessName: inv.business_name || inv.full_name,
          },
          trigger
        );

        if (result.success) {
          await query(
            `INSERT INTO reminder_logs (invoice_id, trigger_type) VALUES ($1, $2)`,
            [inv.id, trigger]
          );
          sent++;
        }
      }
    }

    await finishCronRun(runId, 'success', sent);
    return NextResponse.json({ ok: true, sent, skipped });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Cron reminders error:', e);
    await finishCronRun(runId, 'failed', 0, msg);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
