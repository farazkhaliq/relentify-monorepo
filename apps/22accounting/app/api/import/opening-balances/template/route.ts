// app/api/import/opening-balances/template/route.ts
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { getChartOfAccounts } from '@/src/lib/chart_of_accounts.service';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'opening_balances')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const accounts = await getChartOfAccounts(entity.id);
    const active = accounts.filter((a: any) => a.is_active !== false);

    const wb = new ExcelJS.Workbook();

    // --- Main sheet ---
    const ws = wb.addWorksheet('Opening Balances');

    ws.addRow(['Account Code', 'Account Name', 'Account Type', 'Opening Debit (£)', 'Opening Credit (£)']);
    for (const a of active) {
      ws.addRow([a.code, a.name, a.account_type, 0, 0]);
    }

    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 36;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 20;

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Format debit/credit columns as numbers
    ws.getColumn(4).numFmt = '#,##0.00';
    ws.getColumn(5).numFmt = '#,##0.00';

    // --- Instructions sheet ---
    const wsInstr = wb.addWorksheet('Instructions');
    wsInstr.getColumn(1).width = 80;
    const instrRows = [
      ['Opening Balances Import — Instructions'],
      [''],
      ['1. Fill in "Opening Debit (£)" or "Opening Credit (£)" for each account that has a balance.'],
      ['2. Leave both columns blank (or as 0) for accounts with no opening balance.'],
      ['3. The "Account Code" and "Account Name" columns are for reference only — do not edit them.'],
      ['4. Do not add or remove rows.'],
      ['5. If your debits and credits do not balance, the difference will be posted to Suspense (9999) automatically.'],
      ['6. Tip: export your Trial Balance from your old system and use it to fill in the figures.'],
      [''],
      ['Common opening balances to include:'],
      ['  - Bank account balance (e.g. account 1200)'],
      ['  - Debtors outstanding (account 1100)'],
      ['  - Creditors outstanding (account 2100)'],
      ['  - VAT owed/owing (accounts 2202, 1201)'],
      ['  - Retained earnings to date (account 3001)'],
    ];
    for (const row of instrRows) {
      wsInstr.addRow(row);
    }

    const buf = await wb.xlsx.writeBuffer();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="opening-balances-template.xlsx"',
      },
    });
  } catch (err) {
    console.error('[opening-balances/template]', err);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
