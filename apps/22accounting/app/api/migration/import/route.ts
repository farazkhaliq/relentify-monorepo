// app/api/migration/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { logAudit } from '@/src/lib/audit.service';
import { query } from '@/src/lib/db';
import { importMigration } from '@/src/lib/migration/import.service';
import { validateTrialBalance } from '@/src/lib/migration/validation';
import type { MigrationRunPayload } from '@/src/lib/migration/types';

export const runtime = 'nodejs';

function san(s: unknown): string {
  return String(s ?? '').replace(/\0/g, '').trim();
}
function sanNum(v: unknown): number {
  const n = parseFloat(String(v ?? ''));
  return isFinite(n) ? n : 0;
}

const VALID_SOURCES = new Set(['xero', 'quickbooks']);

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'platform_migration')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use the migration tool' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json() as MigrationRunPayload & { resumeRunId?: string };

    if (!VALID_SOURCES.has(body.source)) {
      return NextResponse.json({ error: 'Invalid source — must be xero or quickbooks' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.cutoffDate ?? '')) {
      return NextResponse.json({ error: 'Invalid cutoff date — expected YYYY-MM-DD' }, { status: 400 });
    }

    const d = body.data;
    if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.invoices) || !Array.isArray(d.bills)) {
      return NextResponse.json({ error: 'Invalid migration data structure' }, { status: 400 });
    }

    // Sanitise all string fields
    d.customers = (d.customers ?? []).map(c => ({ ...c, name: san(c.name), email: san(c.email) }));
    d.suppliers = (d.suppliers ?? []).map(s => ({ ...s, name: san(s.name) }));
    d.invoices  = (d.invoices ?? []).map(inv => ({
      ...inv,
      clientName: san(inv.clientName),
      sourceRef:  san(inv.sourceRef),
      items: (inv.items ?? []).map(it => ({
        ...it,
        description: san(it.description),
        quantity:    sanNum(it.quantity),
        unitPrice:   sanNum(it.unitPrice),
        taxRate:     sanNum(it.taxRate),
      })),
    }));
    d.bills = (d.bills ?? []).map(b => ({
      ...b,
      supplierName: san(b.supplierName),
      amount:       sanNum(b.amount),
      vatAmount:    sanNum(b.vatAmount),
    }));
    d.openingBalances = (d.openingBalances ?? []).map(ob => ({
      accountCode: Math.floor(sanNum(ob.accountCode)),
      debit:       sanNum(ob.debit),
      credit:      sanNum(ob.credit),
    }));

    // Trial balance check
    const tbResult = validateTrialBalance(d.trialBalance);
    if (!tbResult.valid) {
      return NextResponse.json({
        error: `Trial balance does not balance — discrepancy: £${tbResult.discrepancy.toFixed(2)}`,
      }, { status: 422 });
    }

    // Determine skip batches (resume flow)
    let runId: string;
    let skipBatches: string[] = [];

    if (body.resumeRunId) {
      const prev = await query(
        `SELECT * FROM migration_runs WHERE id = $1 AND entity_id = $2`,
        [body.resumeRunId, entity.id]
      );
      if (!prev.rows[0]) return NextResponse.json({ error: 'Previous run not found' }, { status: 404 });
      runId = body.resumeRunId;
      const prevBatches = prev.rows[0].batches as Array<{ type: string; status: string }>;
      skipBatches = prevBatches.filter(b => b.status === 'completed').map(b => b.type);
    } else {
      const r = await query(
        `INSERT INTO migration_runs (entity_id, user_id, source, cutoff_date, files_uploaded, auto_mappings, validation_warnings, batches)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          entity.id, auth.userId, body.source, body.cutoffDate,
          JSON.stringify(body.data.accounts.map(a => ({ name: a.sourceName }))),
          JSON.stringify(body.mappings ?? []),
          JSON.stringify([]),
          JSON.stringify([]),
        ]
      );
      runId = r.rows[0].id;
    }

    const result = await importMigration({
      entityId:   entity.id,
      userId:     auth.userId,
      cutoffDate: body.cutoffDate,
      data:       d,
      mappings:   body.mappings ?? [],
      runId,
      skipBatches,
    });

    await logAudit(auth.userId, 'migration_import', 'entity', entity.id, {
      source:    body.source,
      runId,
      batchSummary: result.batches.map(b => ({ type: b.type, status: b.status, count: b.count })),
    });

    return NextResponse.json({
      success: true,
      runId,
      batches:      result.batches,
      importReport: result.importReport,
    });

  } catch (err: any) {
    console.error('[migration/import]', err);
    return NextResponse.json({ error: err.message || 'Migration failed' }, { status: 500 });
  }
}
