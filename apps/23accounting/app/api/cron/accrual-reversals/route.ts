import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/src/lib/db';
import { reverseJournalEntry } from '@/src/lib/general_ledger.service';
import { logAudit } from '@/src/lib/audit.service';
import { startCronRun, finishCronRun } from '@/src/lib/cron-monitor.service';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = await startCronRun('accrual-reversals');
  const today = new Date().toISOString().split('T')[0];
  let reversed = 0;

  try {
    const entries = await query(
      `SELECT id, entity_id, user_id FROM acc_journal_entries
       WHERE is_accrual = TRUE
         AND reversal_date::date = $1::date
         AND reversed_by IS NULL
         AND status = 'posted'`,
      [today]
    );

    for (const entry of entries.rows) {
      const reversalId = await reverseJournalEntry(entry.id, entry.user_id, today);
      await query(
        `UPDATE acc_journal_entries SET reversed_by = $1 WHERE id = $2`,
        [reversalId, entry.id]
      );
      await logAudit(
        entry.user_id,
        'journal.accrual_auto_reversed',
        'journal_entry',
        entry.id,
        { reversalId, reversalDate: today }
      );
      reversed++;
    }

    await finishCronRun(runId, 'success', reversed);
    return NextResponse.json({ ok: true, reversed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Accrual reversals cron error:', e);
    await finishCronRun(runId, 'failed', 0, msg);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
