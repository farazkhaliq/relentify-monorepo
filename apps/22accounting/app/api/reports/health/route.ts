import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { query } from '@/src/lib/db';

type CheckStatus = 'ok' | 'warning' | 'error';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const entityId = entity.id;
    const userId = auth.userId;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoff = ninetyDaysAgo.toISOString().split('T')[0];

    // ── 1. Unmatched bank transactions (last 90 days) ──────────────────────────
    const [unmatchedRes, totalBankRes] = await Promise.all([
      query(
        `SELECT COUNT(*) AS count FROM bank_transactions
         WHERE user_id=$1::uuid AND entity_id=$2::uuid
           AND status='unmatched'
           AND transaction_date >= $3`,
        [userId, entityId, cutoff]
      ),
      query(
        `SELECT COUNT(*) AS count FROM bank_transactions
         WHERE user_id=$1::uuid AND entity_id=$2::uuid
           AND transaction_date >= $3`,
        [userId, entityId, cutoff]
      ),
    ]);

    const unmatchedCount = parseInt(unmatchedRes.rows[0]?.count ?? '0');
    const totalBankCount = parseInt(totalBankRes.rows[0]?.count ?? '0');
    const matchedCount = totalBankCount - unmatchedCount;
    const reconciliationPct = totalBankCount > 0
      ? Math.round((matchedCount / totalBankCount) * 100)
      : 100;

    // Lose 2 pts per unmatched transaction, max deduction 25
    const reconciliationScore = clamp(25 - unmatchedCount * 2, 0, 25);
    const reconciliationStatus: CheckStatus =
      reconciliationScore === 25 ? 'ok' : reconciliationScore >= 15 ? 'warning' : 'error';

    // ── 2. Missing receipts (bills + expenses + mileage, last 90 days) ─────────
    const missingReceiptsRes = await query(
      `SELECT COUNT(*) AS count FROM (
         SELECT b.id FROM bills b
         WHERE b.user_id=$1::uuid AND b.entity_id=$2::uuid
           AND b.created_at::date >= $3
           AND NOT EXISTS (
             SELECT 1 FROM attachments a
             WHERE a.entity_id=$2::uuid AND a.record_type='bill' AND a.record_id=b.id
           )
         UNION ALL
         SELECT e.id FROM expenses e
         WHERE e.user_id=$1::uuid
           AND e.created_at::date >= $3
           AND NOT EXISTS (
             SELECT 1 FROM attachments a
             WHERE a.entity_id=$2::uuid AND a.record_type='expense' AND a.record_id=e.id
           )
         UNION ALL
         SELECT mc.id FROM mileage_claims mc
         WHERE mc.user_id=$1::uuid
           AND mc.created_at::date >= $3
           AND NOT EXISTS (
             SELECT 1 FROM attachments a
             WHERE a.entity_id=$2::uuid AND a.record_type='mileage' AND a.record_id=mc.id
           )
       ) AS missing`,
      [userId, entityId, cutoff]
    );

    const missingReceiptsCount = parseInt(missingReceiptsRes.rows[0]?.count ?? '0');

    // Lose 3 pts per missing receipt, max deduction 25
    const missingReceiptsScore = clamp(25 - missingReceiptsCount * 3, 0, 25);
    const missingReceiptsStatus: CheckStatus =
      missingReceiptsScore === 25 ? 'ok' : missingReceiptsScore >= 15 ? 'warning' : 'error';

    // ── 3. Overdue invoices ────────────────────────────────────────────────────
    const overdueRes = await query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total_amount
       FROM invoices
       WHERE user_id=$1::uuid AND entity_id=$2::uuid
         AND status IN ('sent', 'overdue')
         AND due_date < CURRENT_DATE`,
      [userId, entityId]
    );

    const overdueCount = parseInt(overdueRes.rows[0]?.count ?? '0');
    const overdueAmount = parseFloat(overdueRes.rows[0]?.total_amount ?? '0');

    // Lose 5 pts per overdue invoice, max deduction 25
    const overdueScore = clamp(25 - overdueCount * 5, 0, 25);
    const overdueStatus: CheckStatus =
      overdueScore === 25 ? 'ok' : overdueScore >= 10 ? 'warning' : 'error';

    // ── 4. VAT compliance ──────────────────────────────────────────────────────
    let vatScore = 25;
    let vatStatus: CheckStatus = 'ok';
    let vatIssueCount = 0;
    let vatIssueDetail = '';

    const vatRegistered: boolean = entity.vat_registered ?? false;
    const vatNumber: string | null = entity.vat_number ?? null;

    if (vatRegistered && !vatNumber) {
      // VAT registered but no VAT number on file
      vatScore = 0;
      vatStatus = 'error';
      vatIssueDetail = 'VAT registered but no VAT number set in Settings';
      vatIssueCount = 1;
    }

    // ── Total score ────────────────────────────────────────────────────────────
    const totalScore = reconciliationScore + missingReceiptsScore + overdueScore + vatScore;

    const overallStatus: CheckStatus =
      totalScore >= 80 ? 'ok' : totalScore >= 50 ? 'warning' : 'error';

    return NextResponse.json({
      score: totalScore,
      maxScore: 100,
      overallStatus,
      checks: {
        reconciliation: {
          score: reconciliationScore,
          maxScore: 25,
          status: reconciliationStatus,
          unmatchedCount,
          matchedCount,
          totalCount: totalBankCount,
          pct: reconciliationPct,
        },
        missingReceipts: {
          score: missingReceiptsScore,
          maxScore: 25,
          status: missingReceiptsStatus,
          count: missingReceiptsCount,
        },
        overdueInvoices: {
          score: overdueScore,
          maxScore: 25,
          status: overdueStatus,
          count: overdueCount,
          totalAmount: overdueAmount,
        },
        vatCompliance: {
          score: vatScore,
          maxScore: 25,
          status: vatStatus,
          issueCount: vatIssueCount,
          detail: vatIssueDetail,
          vatRegistered,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[health-score]', e);
    return NextResponse.json({ error: 'Failed to calculate health score' }, { status: 500 });
  }
}
