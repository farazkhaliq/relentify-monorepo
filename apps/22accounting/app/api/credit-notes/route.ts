import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { getCreditNotesByEntity, createCreditNote } from '@/src/lib/credit_note.service';
import { canAccess } from '@/src/lib/tiers';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'credit_notes'))
      return NextResponse.json({ error: 'Upgrade to Sole Trader or above to use credit notes' }, { status: 403 });
    const notes = await getCreditNotesByEntity(entity.id);
    return NextResponse.json({ credit_notes: notes });
  } catch (e: unknown) {
    console.error('[credit-notes GET]', e);
    return NextResponse.json({ error: 'Failed to fetch credit notes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'credit_notes'))
      return NextResponse.json({ error: 'Upgrade to Sole Trader or above to use credit notes' }, { status: 403 });

    const body = await req.json();
    const { clientName, clientEmail, customerId, invoiceId, issueDate, reason, notes, currency, items } = body;

    if (!clientName) return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    if (!items || !items.length) return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });

    const dateToCheck = issueDate || new Date().toISOString().split('T')[0];
    const lockCheck = await isDateLocked(entity.id, dateToCheck, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }

    const cn = await createCreditNote({
      userId:      auth.userId,
      entityId:    entity.id,
      customerId,
      invoiceId,
      clientName,
      clientEmail,
      issueDate,
      taxRate:     0, // VAT handled per line item
      reason,
      notes,
      currency:    currency || 'GBP',
      items,
    });

    return NextResponse.json({ credit_note: cn }, { status: 201 });
  } catch (e: unknown) {
    console.error('[credit-notes POST]', e);
    const msg = e instanceof Error ? e.message : 'Failed to create credit note';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
