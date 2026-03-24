import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getMileageClaims, createMileageClaim } from '@/src/lib/expense.service';
import { canAccess } from '@/src/lib/tiers';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { isDateLocked } from '@/src/lib/period_lock.service';
import { getExpenseApprovalSettings } from '@/src/lib/expense_approval.service';
import { sendExpenseApprovalRequestEmail } from '@/src/lib/email';
import { query } from '@/src/lib/db';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const claims = await getMileageClaims(auth.userId);
    return NextResponse.json({ claims });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'expenses_mileage')) {
      return NextResponse.json({ error: 'Upgrade to access mileage claims' }, { status: 403 });
    }

    const body = await req.json();
    const { date, description, fromLocation, toLocation, miles, rate } = body;

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    if (!miles || isNaN(parseFloat(miles)) || parseFloat(miles) <= 0) {
      return NextResponse.json({ error: 'Valid mileage is required' }, { status: 400 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (entity) {
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

    const approvalSettings = entity ? await getExpenseApprovalSettings(entity.id) : null;
    const needsApproval = approvalSettings?.enabled && !!approvalSettings.approver_user_id;

    const claim = await createMileageClaim(auth.userId, {
      entityId: entity?.id,
      date, description, fromLocation, toLocation,
      miles: parseFloat(miles),
      rate: rate ? parseFloat(rate) : undefined,
      skipGL: needsApproval,
    });

    if (needsApproval && entity) {
      await query(`UPDATE mileage_claims SET status = 'pending_approval' WHERE id = $1`, [claim.id]);
      claim.status = 'pending_approval' as any;

      const approverRow = await query(
        `SELECT full_name, email FROM users WHERE id = $1`,
        [approvalSettings.approver_user_id]
      );
      const approver = approverRow.rows[0];
      if (approver?.email) {
        await sendExpenseApprovalRequestEmail({
          to: approver.email,
          approverName: approver.full_name,
          claimerName: (await query(`SELECT full_name FROM users WHERE id = $1`, [auth.userId])).rows[0]?.full_name || 'A team member',
          description,
          amount: parseFloat(miles) * (rate ? parseFloat(rate) : 0.45),
          expenseId: claim.id,
          type: 'mileage',
        });
      }
    }

    return NextResponse.json({ claim }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create mileage claim' }, { status: 500 });
  }
}
