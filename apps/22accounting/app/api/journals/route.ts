import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { postJournalEntry } from '@/src/lib/general_ledger.service';
import { logAudit } from '@/src/lib/audit.service';
import { isDateLocked } from '@/src/lib/period_lock.service';
import { query } from '@/src/lib/db';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const r = await query(
      `SELECT je.id, je.entry_date, je.reference, je.description, je.source_type, je.created_at,
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
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json();
    const { date, reference, description, lines } = body as {
      date: string;
      reference?: string;
      description?: string;
      lines: Array<{ accountId: string; description?: string; debit: number; credit: number }>;
    };

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!lines || lines.length < 2) return NextResponse.json({ error: 'At least 2 lines required' }, { status: 400 });

    const lockCheck = await isDateLocked(entity.id, date, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }

    const entryId = await postJournalEntry({
      entityId: entity.id,
      userId: auth.userId,
      date,
      reference: reference || undefined,
      description: description || undefined,
      sourceType: 'manual',
      lines,
    });

    await logAudit(auth.userId, 'journal.created', 'journal_entry', entryId, {
      reference, description, lineCount: lines.length,
    });

    return NextResponse.json({ id: entryId }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create journal entry';
    console.error('[POST /api/journals]', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
