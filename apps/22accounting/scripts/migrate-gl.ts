/**
 * Historical GL migration script.
 * Seeds default COA for all existing entities, then generates journal entries
 * for all pre-existing invoices, bills, and expenses that have no GL entry yet.
 *
 * Run once after deploying migrations 013-015:
 *   docker exec relentify-accounts npx ts-node --project tsconfig.json scripts/migrate-gl.ts
 */

import { query } from '@/src/lib/db';
import { seedDefaultCOA } from '@/src/lib/chart_of_accounts.service';
import {
  postJournalEntry,
  buildInvoiceCreationLines,
  buildInvoicePaymentLines,
  buildBillCreationLines,
  buildBillPaymentLines,
  buildExpenseLines,
} from '@/src/lib/general_ledger.service';
import { getAccountByCode } from '@/src/lib/chart_of_accounts.service';

// Fallback category → nominal code (mirrors bill.service.ts)
const CATEGORY_TO_CODE: Record<string, number> = {
  advertising: 7100, bank_charges: 7700, entertainment: 7200,
  equipment: 1700, general: 7900, insurance: 8000,
  it_software: 7500, marketing: 7100, materials: 5001,
  office: 7400, office_supplies: 7400, professional: 7600,
  rent: 8100, repairs: 8200, salaries: 7000, software: 7500,
  subscriptions: 8300, travel: 7300, utilities: 8400,
};

async function run() {
  console.log('=== GL Historical Migration ===\n');

  // 1. Seed COA for all entities that don't have one yet
  const entities = await query('SELECT id FROM entities ORDER BY created_at ASC');
  console.log(`Found ${entities.rows.length} entities`);
  for (const entity of entities.rows) {
    await seedDefaultCOA(entity.id);
    process.stdout.write('.');
  }
  console.log('\nCOA seed complete\n');

  // 2. Migrate invoices — skip any that already have a GL entry
  const invoices = await query(`
    SELECT i.* FROM invoices i
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.source_type = 'invoice' AND je.source_id = i.id::text
    )
    ORDER BY i.created_at ASC
  `);
  console.log(`Migrating ${invoices.rows.length} invoices...`);
  let ok = 0; let fail = 0;
  for (const inv of invoices.rows) {
    try {
      const total = parseFloat(inv.total);
      const subtotal = parseFloat(inv.subtotal);
      const taxAmt = parseFloat(inv.tax_amount);
      const glLines = await buildInvoiceCreationLines(inv.entity_id, total, subtotal, taxAmt);
      await postJournalEntry({
        entityId: inv.entity_id,
        userId: inv.user_id,
        date: inv.issue_date || inv.created_at.toISOString().split('T')[0],
        reference: inv.invoice_number,
        description: `Invoice to ${inv.client_name}`,
        sourceType: 'invoice',
        sourceId: inv.id,
        lines: glLines,
      });

      if (inv.status === 'paid') {
        const payLines = await buildInvoicePaymentLines(inv.entity_id, total);
        await postJournalEntry({
          entityId: inv.entity_id,
          userId: inv.user_id,
          date: inv.paid_at ? inv.paid_at.toISOString().split('T')[0] : inv.created_at.toISOString().split('T')[0],
          reference: inv.invoice_number,
          description: `Payment received: ${inv.client_name}`,
          sourceType: 'payment',
          sourceId: inv.id,
          lines: payLines,
        });
      }
      ok++;
    } catch (e) {
      fail++;
      console.error(`  Invoice ${inv.invoice_number} failed:`, (e as Error).message);
    }
  }
  console.log(`Invoices: ${ok} ok, ${fail} failed\n`);

  // 3. Migrate bills
  const bills = await query(`
    SELECT b.* FROM bills b
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.source_type = 'bill' AND je.source_id = b.id::text
    )
    ORDER BY b.created_at ASC
  `);
  console.log(`Migrating ${bills.rows.length} bills...`);
  ok = 0; fail = 0;
  for (const bill of bills.rows) {
    try {
      let expenseAccountId: string | undefined = bill.coa_account_id;
      if (!expenseAccountId) {
        const code = CATEGORY_TO_CODE[bill.category || ''] || 7900;
        const acct = await getAccountByCode(bill.entity_id, code);
        expenseAccountId = acct?.id;
      }
      if (!expenseAccountId) { fail++; continue; }

      const netAmt = parseFloat(bill.amount);
      const vatAmt = parseFloat(bill.vat_amount || '0');
      const glLines = await buildBillCreationLines(bill.entity_id, netAmt, vatAmt, expenseAccountId);
      await postJournalEntry({
        entityId: bill.entity_id,
        userId: bill.user_id,
        date: bill.invoice_date || bill.due_date || bill.created_at.toISOString().split('T')[0],
        reference: bill.reference || undefined,
        description: `Bill from ${bill.supplier_name}`,
        sourceType: 'bill',
        sourceId: bill.id,
        lines: glLines,
      });

      if (bill.status === 'paid') {
        const payLines = await buildBillPaymentLines(bill.entity_id, netAmt + vatAmt);
        await postJournalEntry({
          entityId: bill.entity_id,
          userId: bill.user_id,
          date: bill.paid_at ? bill.paid_at.toISOString().split('T')[0] : bill.created_at.toISOString().split('T')[0],
          description: `Payment to ${bill.supplier_name}`,
          sourceType: 'payment',
          sourceId: bill.id,
          lines: payLines,
        });
      }
      ok++;
    } catch (e) {
      fail++;
      console.error(`  Bill ${bill.id} (${bill.supplier_name}) failed:`, (e as Error).message);
    }
  }
  console.log(`Bills: ${ok} ok, ${fail} failed\n`);

  // 4. Migrate expenses
  const expenses = await query(`
    SELECT e.*, u.active_entity_id as entity_id
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE u.active_entity_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.source_type = 'expense' AND je.source_id = e.id::text
    )
    ORDER BY e.created_at ASC
  `);
  console.log(`Migrating ${expenses.rows.length} expenses...`);
  ok = 0; fail = 0;
  for (const exp of expenses.rows) {
    try {
      let accountId: string | undefined = exp.coa_account_id;
      if (!accountId) {
        const code = CATEGORY_TO_CODE[exp.category || ''] || 7900;
        const acct = await getAccountByCode(exp.entity_id, code);
        accountId = acct?.id;
      }
      if (!accountId) { fail++; continue; }

      const glLines = await buildExpenseLines(exp.entity_id, parseFloat(exp.gross_amount), accountId);
      await postJournalEntry({
        entityId: exp.entity_id,
        userId: exp.user_id,
        date: exp.date,
        description: `Expense: ${exp.description}`,
        sourceType: 'expense',
        sourceId: exp.id,
        lines: glLines,
      });
      ok++;
    } catch (e) {
      fail++;
      console.error(`  Expense ${exp.id} failed:`, (e as Error).message);
    }
  }
  console.log(`Expenses: ${ok} ok, ${fail} failed\n`);

  console.log('=== Migration complete ===');
  process.exit(0);
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
