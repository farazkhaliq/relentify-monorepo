import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/src/lib/db';
import { getApproverForStaff } from '@/src/lib/po_approver_mapping.service';
import { sendPOApprovalRequestEmail } from '@/src/lib/email';

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find POs pending approval for over 24h with no escalation yet
    const stalePos = await query(`
      SELECT po.*, e.id as entity_id
      FROM purchase_orders po
      JOIN entities e ON e.id = (
        SELECT entity_id FROM users WHERE id = po.user_id LIMIT 1
      )
      WHERE po.status = 'pending_approval'
        AND po.created_at < NOW() - INTERVAL '24 hours'
        AND po.escalated_at IS NULL
      ORDER BY po.created_at ASC
      LIMIT 50
    `);

    if (stalePos.rows.length === 0) {
      return NextResponse.json({ escalated: 0 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.relentify.com';
    let escalatedCount = 0;

    for (const po of stalePos.rows) {
      try {
        const approver = await getApproverForStaff(po.entity_id, po.user_id);
        if (!approver?.approverEmail) continue;

        // Send reminder email
        await sendPOApprovalRequestEmail({
          to: approver.approverEmail,
          approverName: approver.approverName,
          requesterName: po.requester_name || 'A team member',
          poNumber: po.po_number,
          total: parseFloat(po.total),
          currency: po.currency || 'GBP',
          supplierName: po.supplier_name,
          description: po.description || undefined,
          approveUrl: `${appUrl}/api/po/approve-link?token=${po.approval_token}&action=approve`,
          rejectUrl: `${appUrl}/api/po/approve-link?token=${po.approval_token}&action=reject`,
        });

        // Mark as escalated
        await query(`UPDATE purchase_orders SET escalated_at = NOW() WHERE id = $1`, [po.id]);
        escalatedCount++;
      } catch (err) {
        console.error(`[PO escalation] Failed for PO ${po.id}:`, err);
      }
    }

    return NextResponse.json({ escalated: escalatedCount });
  } catch (e) {
    console.error('[PO escalation] Error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
