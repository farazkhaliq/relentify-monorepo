import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/src/lib/db';
import { postJournalEntry } from '@/src/lib/general_ledger.service';
import { getAccountByCode } from '@/src/lib/chart_of_accounts.service';
import { startCronRun, finishCronRun } from '@/src/lib/cron-monitor.service';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = await startCronRun('prepayment-release');
  const today = new Date().toISOString().split('T')[0];
  let released = 0;

  try {
    // Find prepayments with months remaining (releases_done < prepayment_months)
    const prepayments = await query(
      `SELECT bt.*,
              bt.amount / bt.prepayment_months::numeric AS monthly_amount,
              (SELECT COUNT(*) FROM acc_journal_entries je
               WHERE je.source_type = 'prepayment_release'
                 AND je.source_id LIKE bt.id::text || '-%') AS releases_done
       FROM acc_bank_transactions bt
       WHERE bt.is_prepayment = TRUE
         AND bt.prepayment_months IS NOT NULL
         AND bt.prepayment_months > 0`,
      []
    );

    for (const p of prepayments.rows) {
      const releasesDone = parseInt(p.releases_done ?? '0');
      if (releasesDone >= parseInt(p.prepayment_months)) continue;

      const releaseNum = releasesDone + 1;

      await withTransaction(async (client) => {
        const prepayAcct = await getAccountByCode(p.entity_id, 1300);
        const expAcct = p.prepayment_exp_acct
          ? { id: p.prepayment_exp_acct }
          : await getAccountByCode(p.entity_id, 7900);
        if (!prepayAcct || !expAcct) return;

        const monthlyAmount = parseFloat(p.monthly_amount);

        await postJournalEntry({
          entityId:    p.entity_id,
          userId:      p.user_id,
          date:        today,
          description: `Prepayment release ${releaseNum}/${p.prepayment_months}`,
          sourceType:  'prepayment_release',
          sourceId:    `${p.id}-${releaseNum}`,
          lines: [
            { accountId: expAcct.id,    description: 'Expense release', debit: monthlyAmount, credit: 0 },
            { accountId: prepayAcct.id, description: 'Prepayments',     debit: 0, credit: monthlyAmount },
          ],
        }, client);
      });

      released++;
    }

    await finishCronRun(runId, 'success', released);
    return NextResponse.json({ ok: true, released });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Prepayment release cron error:', e);
    await finishCronRun(runId, 'failed', 0, msg);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
