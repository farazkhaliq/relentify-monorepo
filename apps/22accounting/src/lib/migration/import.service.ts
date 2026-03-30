// src/lib/migration/import.service.ts
import { withTransaction } from '../db';
import { createCustomer, getAllCustomers } from '../customer.service';
import { createSupplier, getAllSuppliers } from '../supplier.service';
import { createInvoice } from '../invoice.service';
import { createBill } from '../bill.service';
import { importOpeningBalances } from '../opening_balance.service';
import { query } from '../db';
import type { MigrationData, AccountMapping, MigrationBatchResult } from './types';

export interface ImportMigrationOptions {
  entityId:    string;
  userId:      string;
  cutoffDate:  string;
  data:        MigrationData;
  mappings:    AccountMapping[];
  runId:       string;
  skipBatches?: string[];
}

export interface ImportMigrationResult {
  batches:      MigrationBatchResult[];
  importReport: string;
}

export async function importMigration(opts: ImportMigrationOptions): Promise<ImportMigrationResult> {
  const { entityId, userId, cutoffDate, data, mappings, runId, skipBatches = [] } = opts;
  const batches: MigrationBatchResult[] = [];
  const reportLines: string[] = ['type,sourceRef,name,status'];

  const updateRun = async () => {
    await query(
      `UPDATE migration_runs SET batches = $1 WHERE id = $2`,
      [JSON.stringify(batches), runId]
    );
  };

  const existingCustomers = await getAllCustomers(userId, entityId);
  const existingSuppliers = await getAllSuppliers(userId, entityId);
  const custMap = new Map(existingCustomers.map((c: any) => [c.name.toLowerCase(), c.id]));
  const suppMap = new Map(existingSuppliers.map((s: any) => [s.name.toLowerCase(), s.id]));

  // ── Batch: customers ──
  if (!skipBatches.includes('customers')) {
    const b: MigrationBatchResult = { type: 'customers', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const c of data.customers) {
        if (custMap.has(c.name.toLowerCase())) {
          reportLines.push(`customer,,${c.name},merged_existing`);
          continue;
        }
        const created = await createCustomer({ userId, entityId, name: c.name, email: c.email, phone: c.phone, address: c.address });
        custMap.set(c.name.toLowerCase(), created.id);
        b.count++;
        reportLines.push(`customer,${created.id},${c.name},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: suppliers ──
  if (!skipBatches.includes('suppliers')) {
    const b: MigrationBatchResult = { type: 'suppliers', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const s of data.suppliers) {
        if (suppMap.has(s.name.toLowerCase())) {
          reportLines.push(`supplier,,${s.name},merged_existing`);
          continue;
        }
        const created = await createSupplier({ userId, entityId, name: s.name, email: s.email, phone: s.phone, address: s.address });
        suppMap.set(s.name.toLowerCase(), created.id);
        b.count++;
        reportLines.push(`supplier,${created.id},${s.name},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: invoices ──
  if (!skipBatches.includes('invoices')) {
    const b: MigrationBatchResult = { type: 'invoices', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const inv of data.invoices) {
        let customerId = custMap.get(inv.clientName.toLowerCase());
        if (!customerId) {
          const c = await createCustomer({ userId, entityId, name: inv.clientName });
          custMap.set(inv.clientName.toLowerCase(), c.id);
          customerId = c.id;
        }
        const created = await createInvoice({
          userId, entityId,
          customerId,
          clientName:    inv.clientName,
          issueDate:     inv.issueDate,
          dueDate:       inv.dueDate,
          currency:      inv.currency,
          taxRate:       inv.taxRate,
          items:         inv.items,
          skipGLPosting: true,
        });
        b.count++;
        reportLines.push(`invoice,${created.id},${inv.sourceRef},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: bills ──
  if (!skipBatches.includes('bills')) {
    const b: MigrationBatchResult = { type: 'bills', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const bill of data.bills) {
        const mapping = mappings.find(m => m.sourceCode === bill.sourceRef);
        const coaAccountId = mapping?.targetCode
          ? String(mapping.targetCode)
          : undefined;
        const created = await createBill(userId, {
          entityId,
          supplierName:  bill.supplierName,
          amount:        bill.amount,
          currency:      bill.currency,
          dueDate:       bill.dueDate,
          invoiceDate:   bill.issueDate,
          category:      bill.category,
          vatRate:       bill.vatRate,
          vatAmount:     bill.vatAmount,
          reference:     bill.sourceRef || undefined,
          coaAccountId,
          skipGLPosting: true,
        });
        b.count++;
        reportLines.push(`bill,${created.id},${bill.sourceRef},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: opening_balances — MUST succeed or import is incomplete ──
  if (!skipBatches.includes('opening_balances')) {
    const b: MigrationBatchResult = { type: 'opening_balances', status: 'running', count: 0 };
    batches.push(b);
    try {
      await withTransaction(async (_client) => {
        const result = await importOpeningBalances(
          entityId,
          userId,
          cutoffDate,
          data.openingBalances.map(l => ({
            accountCode: l.accountCode,
            debit:       l.debit,
            credit:      l.credit,
          }))
        );
        b.count = result.linesImported;
        reportLines.push(`opening_balances,${result.journalEntryId},cutoff ${cutoffDate},created`);
      });
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
      await updateRun();
      throw err;
    }
    await updateRun();
  }

  const importReport = reportLines.join('\n');
  await query(
    `UPDATE migration_runs SET import_report = $1 WHERE id = $2`,
    [importReport, runId]
  );

  return { batches, importReport };
}
