import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { invoiceSchema } from '@/src/lib/validation';
import { createInvoice, getInvoicesByUser } from '@/src/lib/invoice.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  return NextResponse.json({ invoices: await getInvoicesByUser(auth.userId, entity?.id) });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const denied = checkPermission(auth, 'invoices', 'create');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const parsed = invoiceSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    if (parsed.data.currency && parsed.data.currency !== 'GBP') {
      const user = await getUserById(auth.userId);
      if (!canAccess(user?.tier, 'multi_currency')) {
        return NextResponse.json({ error: 'Multi-currency invoicing requires the Medium Business plan or above' }, { status: 403 });
      }
    }

    const issueDate = (parsed.data as any).issueDate || new Date().toISOString().split('T')[0];
    const lockCheck = await isDateLocked(entity.id, issueDate, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }

    const { customerId, projectId, ...invoiceData } = parsed.data;
    const invoice = await createInvoice({
      userId: auth.userId,
      entityId: entity.id,
      customerId,
      projectId,
      ...invoiceData,
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (e) { console.error('Create invoice error:', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
