// app/api/import/opening-balances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { logAudit } from '@/src/lib/audit.service';
import {
  getExistingOpeningBalanceEntry,
  voidOpeningBalanceEntry,
  importOpeningBalances,
} from '@/src/lib/opening_balance.service';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

function numVal(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'opening_balances')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const asOfDate = formData.get('asOfDate') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return NextResponse.json({ error: 'Invalid or missing asOfDate (expected YYYY-MM-DD)' }, { status: 400 });
    }

    // Parse file
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];

    // Extract header row (1-indexed, index 0 is undefined in exceljs)
    const headerValues = ws.getRow(1).values as unknown[];
    const headers = (headerValues as string[]).slice(1).map(h => String(h ?? '').trim());

    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as unknown[];
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i + 1] ?? '';
      });
      rows.push(obj);
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or could not be parsed' }, { status: 400 });
    }

    // Map rows — support both template column names and plain CSV headers
    const lines = rows.map((row: any) => ({
      accountCode: parseInt(
        String(row['Account Code'] ?? row['account_code'] ?? row['Code'] ?? '').trim(),
        10
      ),
      debit:  numVal(row['Opening Debit (£)']  ?? row['opening_debit']  ?? row['Debit']  ?? ''),
      credit: numVal(row['Opening Credit (£)'] ?? row['opening_credit'] ?? row['Credit'] ?? ''),
    })).filter(l => !isNaN(l.accountCode) && l.accountCode > 0);

    if (lines.length === 0) {
      return NextResponse.json({ error: 'No valid account rows found. Check column headers match the template.' }, { status: 400 });
    }

    // Check if existing opening balance entry — client must pass confirmReplace=true to overwrite
    const existing = await getExistingOpeningBalanceEntry(entity.id);
    const confirmReplace = formData.get('confirmReplace') === 'true';

    if (existing && !confirmReplace) {
      return NextResponse.json({
        error: 'EXISTING_OPENING_BALANCE',
        existingDate: existing.entry_date,
        existingId: existing.id,
      }, { status: 409 });
    }

    if (existing && confirmReplace) {
      await voidOpeningBalanceEntry(existing.id, auth.userId);
    }

    const result = await importOpeningBalances(entity.id, auth.userId, asOfDate, lines);

    await logAudit(auth.userId, 'import_opening_balances', 'entity', entity.id, {
      asOfDate,
      linesImported: result.linesImported,
      suspenseAmount: result.suspenseAmount,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[import/opening-balances]', err);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}
