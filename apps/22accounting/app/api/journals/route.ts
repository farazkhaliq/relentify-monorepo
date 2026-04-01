import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { postJournalEntry } from '@/src/lib/general_ledger.service';
import { logAudit } from '@/src/lib/audit.service';
import { isDateLocked } from '@/src/lib/period_lock.service';
import { requireGLRole } from '@/src/lib/team.service';
import { query, withTransaction } from '@/src/lib/db';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const r = await query(
      `SELECT je.id, je.entry_date, je.reference, je.description, je.source_type, je.created_at,
              je.status, je.reversed_by, je.is_accrual,
              COALESCE(SUM(jl.debit), 0) AS total_debit,
              COUNT(jl.id) AS line_count
       FROM journal_entries je
       LEFT JOIN journal_lines jl ON jl.entry_id = je.id
       WHERE je.entity_id = $1 AND je.source_type = 'manual'
       GROUP BY je.id
       ORDER BY je.entry_date DESC, je.created_at DESC
       LIMIT 200`,
      [entity.id]
    );

    return NextResponse.json({ journals: r.rows });
  } catch (e) {
    console.error('[GET /api/journals]', e);
    return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'journals', 'create');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    try {
      await requireGLRole(entity.user_id, auth.userId, ['admin', 'accountant'])
    } catch {
      return NextResponse.json({ error: 'Only admin or accountant roles may post manual journals' }, { status: 403 })
    }

    const body = await req.json();
    const { date, reference, description, lines, status, isAccrual, reversalDate } = body as {
      date: string;
      reference?: string;
      description?: string;
      status?: 'draft' | 'posted';
      isAccrual?: boolean;
      reversalDate?: string;
      lines: Array<{ accountId: string; description?: string; debit: number; credit: number }>;
    };

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!lines || lines.length < 2) return NextResponse.json({ error: 'At least 2 lines required' }, { status: 400 });

    const postStatus = status === 'draft' ? 'draft' : 'posted';

    // Period lock only applies to posted entries
    if (postStatus === 'posted') {
      const lockCheck = await isDateLocked(entity.id, date, auth.userId);
      if (lockCheck.locked) {
        return NextResponse.json({
          error: 'PERIOD_LOCKED',
          lockedThrough: lockCheck.lockedThrough,
          reason: lockCheck.reason,
          earliestUnlockedDate: lockCheck.earliestUnlockedDate,
        }, { status: 403 });
      }
    }

    let entryId: string;

    if (postStatus === 'draft') {
      // Draft: insert header + lines directly, no GL posting
      entryId = await withTransaction(async (client) => {
        const r = await client.query(
          `INSERT INTO journal_entries
             (entity_id, user_id, entry_date, reference, description, source_type, status, is_accrual, reversal_date)
           VALUES ($1,$2,$3,$4,$5,'manual','draft',$6,$7) RETURNING id`,
          [entity.id, auth.userId, date, reference ?? null, description ?? null, isAccrual ?? false, reversalDate ?? null]
        );
        const eid = r.rows[0].id as string;
        for (const line of lines) {
          await client.query(
            `INSERT INTO journal_lines (entry_id, account_id, description, debit, credit) VALUES ($1,$2,$3,$4,$5)`,
            [eid, line.accountId, line.description ?? null, line.debit || 0, line.credit || 0]
          );
        }
        return eid;
      });
      await logAudit(auth.userId, 'journal.draft_saved', 'journal_entry', entryId, {
        reference, description, lineCount: lines.length,
      });
    } else {
      // Posted: use postJournalEntry (handles balance check + period lock + GL)
      entryId = await postJournalEntry({
        entityId: entity.id,
        userId: auth.userId,
        date,
        reference: reference || undefined,
        description: description || undefined,
        sourceType: 'manual',
        lines,
      });
      // Persist accrual metadata if provided
      if (isAccrual || reversalDate) {
        await query(
          `UPDATE journal_entries SET is_accrual=$1, reversal_date=$2 WHERE id=$3`,
          [isAccrual ?? false, reversalDate ?? null, entryId]
        );
      }
      await logAudit(auth.userId, 'journal.created', 'journal_entry', entryId, {
        reference, description, lineCount: lines.length, isAccrual, reversalDate,
      });
    }

    return NextResponse.json({ id: entryId }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create journal entry';
    console.error('[POST /api/journals]', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
