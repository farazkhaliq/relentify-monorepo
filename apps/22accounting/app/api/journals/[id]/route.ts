import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { reverseJournalEntry } from '@/src/lib/general_ledger.service';
import { logAudit } from '@/src/lib/audit.service';
import { isDateLocked } from '@/src/lib/period_lock.service';
import { query } from '@/src/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const r = await query(
      `SELECT je.*, u.full_name as created_by_name
       FROM journal_entries je
       LEFT JOIN users u ON u.id = je.user_id
       WHERE je.id = $1 AND je.entity_id = $2`,
      [id, entity.id]
    );
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const lines = await query(
      `SELECT jl.*, coa.code, coa.name as account_name
       FROM journal_lines jl
       LEFT JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE jl.entry_id = $1 ORDER BY jl.id`,
      [id]
    );

    return NextResponse.json({ journal: { ...r.rows[0], lines: lines.rows } });
  } catch (e) {
    console.error('[GET /api/journals/[id]]', e);
    return NextResponse.json({ error: 'Failed to fetch journal' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    // Verify belongs to entity and is manual
    const r = await query(
      `SELECT id, reference, description, source_type, entry_date FROM journal_entries WHERE id=$1 AND entity_id=$2`,
      [id, entity.id]
    );
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (r.rows[0].source_type !== 'manual') {
      return NextResponse.json({ error: 'Only manual journal entries can be reversed from here' }, { status: 403 });
    }

    const entryDate = r.rows[0].entry_date instanceof Date
      ? r.rows[0].entry_date.toISOString().split('T')[0]
      : String(r.rows[0].entry_date).split('T')[0];
    const lockCheck = await isDateLocked(entity.id, entryDate, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    const reversalId = await reverseJournalEntry(id, auth.userId, today);

    await logAudit(auth.userId, 'journal.reversed', 'journal_entry', id, {
      reversalId, reference: r.rows[0].reference,
    });

    return NextResponse.json({ reversalId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to reverse journal entry';
    console.error('[DELETE /api/journals/[id]]', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
