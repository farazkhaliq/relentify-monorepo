import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import {
  getComments, createComment, shouldSendNotification, markRecordRead
} from '@/src/lib/comment.service';
import { sendCommentNotification } from '@/src/lib/email';
import { getUserById } from '@/src/lib/user.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const recordType = searchParams.get('recordType');
  const recordId = searchParams.get('recordId');
  if (!recordType || !recordId) {
    return NextResponse.json({ error: 'recordType and recordId required' }, { status: 400 });
  }

  const comments = await getComments(recordType, recordId);

  // Mark as read for current user
  await markRecordRead(recordType, recordId, auth.userId);

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    recordType, recordId, body, parentId,
    targetUserId, waitingOn
  } = await req.json();

  if (!recordType || !recordId || !body?.trim()) {
    return NextResponse.json({ error: 'recordType, recordId and body required' }, { status: 400 });
  }

  const comment = await createComment({
    userId: auth.userId,
    actorId: auth.isAccountantAccess ? auth.actorId : undefined,
    targetUserId: targetUserId || null,
    recordType,
    recordId,
    parentId: parentId || null,
    body: body.trim(),
    waitingOn: waitingOn || null,
  });

  // Send notification if target exists and has no unread already
  if (targetUserId) {
    const shouldNotify = await shouldSendNotification(targetUserId, recordType, recordId);
    if (shouldNotify) {
      const targetUser = await getUserById(targetUserId);
      if (targetUser?.email) {
        const senderUser = await getUserById(auth.userId);
        const recordTypeLabels: Record<string, string> = {
          bill: 'Bill', invoice: 'Invoice', expense: 'Expense',
          bank_transaction: 'Bank Transaction', journal: 'Journal',
        };
        const appBase = 'https://accounts.relentify.com';
        const recordPaths: Record<string, string> = {
          bill: `${appBase}/dashboard/bills/${recordId}`,
          invoice: `${appBase}/dashboard/invoices/${recordId}`,
          expense: `${appBase}/dashboard/expenses`,
          bank_transaction: `${appBase}/dashboard/banking`,
          journal: `${appBase}/dashboard/journals`,
        };
        await sendCommentNotification({
          to: targetUser.email,
          senderName: senderUser?.full_name || senderUser?.email || 'Someone',
          body: body.trim(),
          recordType,
          recordLabel: `${recordTypeLabels[recordType] ?? recordType} ${recordId.slice(0, 8)}`,
          recordUrl: recordPaths[recordType] ?? appBase,
        });
      }
    }
  }

  return NextResponse.json({ comment }, { status: 201 });
}
