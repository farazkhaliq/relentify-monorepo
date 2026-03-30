// src/lib/migration/xero.parser.ts
import Papa from 'papaparse';
import type { MigrationSource, MigrationData, NormalisedAccount,
  NormalisedContact, NormalisedInvoice, NormalisedBill, NormalisedBalance, NormalisedTrialBalance } from './types';

function parseCsv(content: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim(),
    transform: (v: string) => v.trim(),
  });
  return result.data;
}

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function normaliseDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

const XERO_STATUS_INCLUDE = new Set(['AUTHORISED', 'OUTSTANDING', 'APPROVED']);

const XERO_TYPE_MAP: Record<string, string> = {
  BANK: 'ASSET', CURRENT: 'ASSET', FIXED: 'ASSET', NONCURRENT: 'ASSET',
  CURRLIAB: 'LIABILITY', TERMLIAB: 'LIABILITY', LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'INCOME', SALES: 'INCOME',
  DIRECTCOSTS: 'COGS',
  OVERHEADS: 'EXPENSE', EXPENSE: 'EXPENSE',
};

export class XeroParser implements MigrationSource {
  async parse(files: File[], cutoffDate: string): Promise<MigrationData> {
    const warnings: string[] = [];
    const fileMap = new Map<string, string>();
    for (const f of files) {
      fileMap.set(f.name.toLowerCase().replace(/\s+/g, '_'), await readFile(f));
      fileMap.set(f.name.toLowerCase(), await readFile(f));
    }

    const get = (names: string[]) => {
      for (const n of names) {
        const v = fileMap.get(n) ?? fileMap.get(n.replace(/\s+/g, '_'));
        if (v) return v;
      }
      return null;
    };

    // ── Accounts ──
    const accounts: NormalisedAccount[] = [];
    const coaCsv = get(['chart of accounts.csv', 'chart_of_accounts.csv']);
    if (coaCsv) {
      for (const row of parseCsv(coaCsv)) {
        const sourceType = row['Type'] ?? '';
        accounts.push({
          sourceCode: row['AccountCode'] ?? '',
          sourceName: row['Name'] ?? '',
          sourceType,
          relentifyType: XERO_TYPE_MAP[sourceType.toUpperCase()] ?? sourceType,
        });
      }
    }

    // ── Contacts ──
    const customers: NormalisedContact[] = [];
    const suppliers: NormalisedContact[] = [];
    const contactsCsv = get(['contacts.csv']);
    if (contactsCsv) {
      for (const row of parseCsv(contactsCsv)) {
        const contact: NormalisedContact = {
          name:    row['ContactName'] ?? '',
          email:   row['Email'] || undefined,
          phone:   row['Phone'] || undefined,
          address: row['Street'] || row['Address'] || undefined,
        };
        if (!contact.name) continue;
        const isCust = (row['IsCustomer'] ?? '').toUpperCase() === 'TRUE';
        const isSupp = (row['IsSupplier'] ?? '').toUpperCase() === 'TRUE';
        if (isCust) customers.push(contact);
        if (isSupp) suppliers.push(contact);
      }
    }

    // ── Invoices ──
    const invoices: NormalisedInvoice[] = [];
    const invCsv = get(['invoices.csv']);
    if (invCsv) {
      for (const row of parseCsv(invCsv)) {
        const status = (row['Status'] ?? '').toUpperCase();
        if (!XERO_STATUS_INCLUDE.has(status)) continue;
        const issueDate = normaliseDate(row['InvoiceDate'] ?? '');
        if (!issueDate || issueDate > cutoffDate) continue;
        const dueDate = normaliseDate(row['DueDate'] ?? '') ?? issueDate;
        const unitAmount = parseFloat(row['UnitAmount'] ?? '0') || 0;
        const taxAmount = parseFloat(row['TaxAmount'] ?? '0') || 0;
        const taxRate = unitAmount > 0 ? Math.round((taxAmount / unitAmount) * 100) : 0;
        invoices.push({
          sourceRef:  row['InvoiceNumber'] ?? '',
          clientName: row['ContactName'] ?? '',
          issueDate,
          dueDate,
          currency:   row['Currency'] || 'GBP',
          taxRate,
          items: [{ description: row['Description'] || 'Imported invoice', quantity: 1, unitPrice: unitAmount, taxRate }],
          status: row['Status'] ?? '',
        });
      }
    }

    // ── Bills ──
    const bills: NormalisedBill[] = [];
    const billsCsv = get(['bills.csv']);
    if (billsCsv) {
      for (const row of parseCsv(billsCsv)) {
        const status = (row['Status'] ?? '').toUpperCase();
        if (!XERO_STATUS_INCLUDE.has(status)) continue;
        const issueDate = normaliseDate(row['InvoiceDate'] ?? '');
        if (!issueDate || issueDate > cutoffDate) continue;
        const dueDate = normaliseDate(row['DueDate'] ?? '') ?? issueDate;
        const amount = parseFloat(row['UnitAmount'] ?? '0') || 0;
        const vatAmount = parseFloat(row['TaxAmount'] ?? '0') || 0;
        const vatRate = amount > 0 ? Math.round((vatAmount / amount) * 100) : 0;
        bills.push({
          sourceRef:    row['InvoiceNumber'] ?? '',
          supplierName: row['ContactName'] ?? '',
          issueDate,
          dueDate,
          currency:     row['Currency'] || 'GBP',
          amount,
          vatAmount,
          vatRate,
          category:     'general',
        });
      }
    }

    // ── Trial Balance ──
    const tbLines: NormalisedBalance[] = [];
    const tbCsv = get(['trial balance.csv', 'trial_balance.csv']);
    if (tbCsv) {
      for (const row of parseCsv(tbCsv)) {
        const code = parseInt(row['AccountCode'] ?? '', 10);
        if (isNaN(code)) continue;
        tbLines.push({
          accountCode: code,
          debit:  parseFloat(row['Debit'] ?? '0') || 0,
          credit: parseFloat(row['Credit'] ?? '0') || 0,
        });
      }
    }
    const totalDebits  = tbLines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = tbLines.reduce((s, l) => s + l.credit, 0);
    const trialBalance: NormalisedTrialBalance = { totalDebits, totalCredits, lines: tbLines };

    return {
      accounts, customers, suppliers, invoices, bills,
      openingBalances: tbLines,
      trialBalance,
      parseWarnings: warnings,
    };
  }
}
