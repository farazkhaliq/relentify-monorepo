import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getExpenses, createExpense } from '@/src/lib/expense.service';
import { canAccess } from '@/src/lib/tiers';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { isDateLocked } from '@/src/lib/period_lock.service';
import { getExpenseApprovalSettings } from '@/src/lib/expense_approval.service';
import { sendExpenseApprovalRequestEmail } from '@/src/lib/email';
import { query } from '@/src/lib/db';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const expenses = await getExpenses(auth.userId);
    return NextResponse.json({ expenses });
  } catch (e) {
    console.error('GET expenses error:', e);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'expenses', 'create');
    if (denied) return denied;

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'expenses_mileage')) {
      return NextResponse.json({ error: 'Upgrade to access expense claims' }, { status: 403 });
    }

    const body = await req.json();
    const { date, description, category, grossAmount, vatAmount, notes } = body;

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    if (!grossAmount || isNaN(parseFloat(grossAmount))) return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });

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

    // Check if approval is required for this entity
    const approvalSettings = entity ? await getExpenseApprovalSettings(entity.id) : null;
    const needsApproval = approvalSettings?.enabled && !!approvalSettings.approver_user_id;

    const expense = await createExpense(auth.userId, {
      entityId: entity?.id,
      date, description, category,
      grossAmount: parseFloat(grossAmount),
      vatAmount: vatAmount != null ? parseFloat(vatAmount) : 0,
      notes,
      skipGL: needsApproval, // GL posted on approval if approval required
    });

    // If approval required, update status to pending_approval
    if (needsApproval && entity) {
      await query(`UPDATE acc_expenses SET status = 'pending_approval' WHERE id = $1`, [expense.id]);
      expense.status = 'pending_approval' as any;

      // Notify approver
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
          amount: parseFloat(grossAmount),
          category,
          expenseId: expense.id,
          type: 'expense',
        });
      }
    }

    return NextResponse.json({ expense }, { status: 201 });
  } catch (e) {
    console.error('POST expense error:', e);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
