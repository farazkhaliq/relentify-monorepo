import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getInvoiceById } from '@/src/lib/invoice.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { invoiceSchema } from '@/src/lib/validation';
import { checkPermission } from '@/src/lib/workspace-auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  const { id } = await params;
  try {
    const inv = await getInvoiceById(id, auth.userId, entity?.id);
    if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ invoice: inv });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);

    const { id } = await params;
    const inv = await getInvoiceById(id, auth.userId, entity?.id);
    if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (inv.status !== 'draft') return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 400 });

    const parsed = invoiceSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    if (parsed.data.currency && parsed.data.currency !== 'GBP') {
      const user = await getUserById(auth.userId);
      if (!canAccess(user?.tier, 'multi_currency')) {
        return NextResponse.json({ error: 'Multi-currency invoicing requires the Medium Business plan or above' }, { status: 403 });
      }
    }

    if (entity) {
      const lockCheck = await isDateLocked(entity.id, inv.issue_date, auth.userId);
      if (lockCheck.locked) {
        return NextResponse.json({
          error: 'PERIOD_LOCKED',
          lockedThrough: lockCheck.lockedThrough,
          reason: lockCheck.reason,
          earliestUnlockedDate: lockCheck.earliestUnlockedDate,
        }, { status: 403 });
      }
    }

    const { query } = await import('@/src/lib/db');
    const d = parsed.data;

    const subtotal = d.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxAmount = subtotal * (d.taxRate / 100);
    const total = subtotal + taxAmount;

    await query(
      `UPDATE acc_invoices SET
        client_name=$1, client_email=$2, client_address=$3,
        due_date=$4, tax_rate=$5, tax_amount=$6, subtotal=$7, total=$8,
        payment_terms=$9, notes=$10, currency=$11, updated_at=NOW()
       WHERE id=$12 AND user_id=$13`,
      [
        d.clientName, d.clientEmail || null, d.clientAddress || null,
        d.dueDate, d.taxRate, taxAmount, subtotal, total,
        d.paymentTerms || 'net_30', d.notes || null, d.currency,
        id, auth.userId,
      ]
    );

    // Replace line items — delete old, insert new
    await query('DELETE FROM acc_invoice_items WHERE invoice_id=$1', [id]);
    for (const item of d.items) {
      await query(
        `INSERT INTO acc_invoice_items (invoice_id, description, quantity, unit_price, amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
      );
    }

    const updated = await getInvoiceById(id, auth.userId, entity?.id);
    return NextResponse.json({ invoice: updated });
  } catch (e) {
    console.error('Update invoice error:', e);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const denied = checkPermission(auth, 'invoices', 'delete');
  if (denied) return denied;
  const entity = await getActiveEntity(auth.userId);
  const { id } = await params;
  const inv = await getInvoiceById(id, auth.userId, entity?.id);
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inv.status !== 'draft') return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 400 });
  if (entity) {
    const lockCheck = await isDateLocked(entity.id, inv.issue_date, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }
  }
  const { query } = await import('@/src/lib/db');
  await query('DELETE FROM acc_invoices WHERE id=$1 AND user_id=$2', [id, auth.userId]);
  return NextResponse.json({ success: true });
}
