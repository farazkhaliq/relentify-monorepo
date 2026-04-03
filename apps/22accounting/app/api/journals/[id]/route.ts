import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { reverseJournalEntry, postJournalEntry } from '@/src/lib/general_ledger.service';
import { logAudit } from '@/src/lib/audit.service';
import { isDateLocked } from '@/src/lib/period_lock.service';
import { requireGLRole } from '@/src/lib/team.service';
import { query } from '@/src/lib/db';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const r = await query(
      `SELECT je.*, u.full_name as created_by_name
       FROM acc_journal_entries je
       LEFT JOIN users u ON u.id = je.user_id
       WHERE je.id = $1 AND je.entity_id = $2`,
      [id, entity.id]
    );
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const lines = await query(
      `SELECT jl.*, coa.code, coa.name as account_name
       FROM acc_journal_lines jl
       LEFT JOIN acc_chart_of_accounts coa ON coa.id = jl.account_id
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
    const denied = checkPermission(auth, 'journals', 'create');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    try {
      await requireGLRole(entity.user_id, auth.userId, ['admin', 'accountant'])
    } catch {
      return NextResponse.json({ error: 'Only admin or accountant roles may reverse journal entries' }, { status: 403 })
    }

    // Verify belongs to entity and is manual
    const r = await query(
      `SELECT id, reference, description, source_type, entry_date FROM acc_journal_entries WHERE id=$1 AND entity_id=$2`,
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

// PATCH — post a draft journal entry
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied2 = checkPermission(auth, 'journals', 'create');
    if (denied2) return denied2;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    try {
      await requireGLRole(entity.user_id, auth.userId, ['admin', 'accountant']);
    } catch {
      return NextResponse.json({ error: 'Only admin or accountant roles may post journals' }, { status: 403 });
    }

    // Fetch the draft entry + lines
    const r = await query(
      `SELECT * FROM acc_journal_entries WHERE id=$1 AND entity_id=$2 AND status='draft'`,
      [id, entity.id]
    );
    if (!r.rows[0]) return NextResponse.json({ error: 'Draft journal not found' }, { status: 404 });
    const entry = r.rows[0];

    const linesRes = await query(
      `SELECT account_id, description, debit, credit FROM acc_journal_lines WHERE entry_id=$1`,
      [id]
    );

    const lockCheck = await isDateLocked(entity.id, entry.entry_date, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }

    // Delete the draft then post as a new entry to go through postJournalEntry validation
    await query(`DELETE FROM acc_journal_lines WHERE entry_id=$1`, [id]);
    await query(`DELETE FROM acc_journal_entries WHERE id=$1`, [id]);

    const entryId = await postJournalEntry({
      entityId:    entity.id,
      userId:      auth.userId,
      date:        String(entry.entry_date).split('T')[0],
      reference:   entry.reference ?? undefined,
      description: entry.description ?? undefined,
      sourceType:  'manual',
      lines: linesRes.rows.map((l: { account_id: string; description: string; debit: string; credit: string }) => ({
        accountId:   l.account_id,
        description: l.description,
        debit:       parseFloat(l.debit),
        credit:      parseFloat(l.credit),
      })),
    });

    // Restore accrual metadata if set
    if (entry.is_accrual || entry.reversal_date) {
      await query(
        `UPDATE acc_journal_entries SET is_accrual=$1, reversal_date=$2 WHERE id=$3`,
        [entry.is_accrual ?? false, entry.reversal_date ?? null, entryId]
      );
    }

    await logAudit(auth.userId, 'journal.posted_from_draft', 'journal_entry', entryId, {
      originalDraftId: id, reference: entry.reference,
    });

    return NextResponse.json({ id: entryId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to post journal';
    console.error('[PATCH /api/journals/[id]]', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
