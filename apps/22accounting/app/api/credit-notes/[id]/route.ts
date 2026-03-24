import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { getCreditNoteById, updateCreditNoteStatus, voidCreditNote } from '@/src/lib/credit_note.service';
import { canAccess } from '@/src/lib/tiers';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'credit_notes'))
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    const cn = await getCreditNoteById(id, entity.id);
    if (!cn) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ credit_note: cn });
  } catch (e: unknown) {
    console.error('[credit-notes/[id] GET]', e);
    return NextResponse.json({ error: 'Failed to fetch credit note' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'credit_notes'))
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const body = await req.json();
    const { action, status } = body;

    if (action === 'void') {
      const existing = await getCreditNoteById(id, entity.id);
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const dateToCheck = existing.issue_date instanceof Date
        ? existing.issue_date.toISOString().split('T')[0]
        : String(existing.issue_date).split('T')[0];
      const lockCheck = await isDateLocked(entity.id, dateToCheck, auth.userId);
      if (lockCheck.locked) {
        return NextResponse.json({
          error: 'PERIOD_LOCKED',
          lockedThrough: lockCheck.lockedThrough,
          reason: lockCheck.reason,
          earliestUnlockedDate: lockCheck.earliestUnlockedDate,
        }, { status: 403 });
      }
      const cn = await voidCreditNote(id, entity.id, auth.userId);
      return NextResponse.json({ credit_note: cn });
    }

    if (status) {
      const cn = await updateCreditNoteStatus(id, entity.id, status);
      return NextResponse.json({ credit_note: cn });
    }

    return NextResponse.json({ error: 'No action specified' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[credit-notes/[id] PATCH]', e);
    const msg = e instanceof Error ? e.message : 'Failed to update credit note';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
