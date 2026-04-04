// src/lib/migration/quickbooks.parser.ts
import Papa from 'papaparse';
import type { MigrationSource, MigrationData, NormalisedAccount,
  NormalisedContact, NormalisedInvoice, NormalisedBill, NormalisedBalance,
  NormalisedTrialBalance } from './types';

const QB_TYPE_TO_RELENTIFY: Record<string, string> = {
  'Bank':                  'ASSET',
  'Accounts Receivable':   'ASSET',
  'Other Current Asset':   'ASSET',
  'Fixed Asset':           'ASSET',
  'Accounts Payable':      'LIABILITY',
  'Credit Card':           'LIABILITY',
  'Other Current Liability':'LIABILITY',
  'Long Term Liability':   'LIABILITY',
  'Equity':                'EQUITY',
  'Income':                'INCOME',
  'Cost of Goods Sold':    'COGS',
  'Expense':               'EXPENSE',
  'Other Expense':         'EXPENSE',
  'Other Income':          'INCOME',
};

const KNOWN_IIF_TYPES = new Set(['ACCNT','CUST','VEND','TRNS','SPL']);

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
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [m, d, y] = raw.split('/');
    return `${y}-${m}-${d}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

interface IIFSection {
  headers: string[];
  rows: Record<string, string>[];
}

function parseIIF(content: string): {
  sections: Map<string, IIFSection>;
  warnings: string[];
} {
  const lines = content.replace(/\r/g, '').split('\n');
  const sections = new Map<string, IIFSection>();
  const warnings: string[] = [];
  const unknownCounts = new Map<string, number>();

  let currentType: string | null = null;
  let currentHeaders: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('!')) {
      const parts = line.slice(1).split('\t');
      const type = parts[0];
      if (KNOWN_IIF_TYPES.has(type)) {
        currentType = type;
        currentHeaders = parts.slice(1);
        if (!sections.has(type)) sections.set(type, { headers: currentHeaders, rows: [] });
        else sections.get(type)!.headers = currentHeaders;
      } else {
        currentType = `__unknown__${type}`;
        unknownCounts.set(type, 0);
      }
      continue;
    }

    if (!currentType) continue;

    if (currentType.startsWith('__unknown__')) {
      const t = currentType.slice('__unknown__'.length);
      unknownCounts.set(t, (unknownCounts.get(t) ?? 0) + 1);
      continue;
    }

    const parts = line.split('\t');
    const dataType = parts[0];
    if (dataType !== currentType) continue;

    const values = parts.slice(1);
    const section = sections.get(currentType)!;
    const obj: Record<string, string> = {};
    section.headers.forEach((h, i) => { obj[h] = values[i]?.trim() ?? ''; });
    section.rows.push(obj);
  }

  for (const [type, count] of unknownCounts) {
    warnings.push(`Skipped ${count} row(s) of unknown IIF type: ${type}`);
  }

  return { sections, warnings };
}

export class QuickBooksParser implements MigrationSource {
  async parse(files: File[], cutoffDate: string): Promise<MigrationData> {
    const warnings: string[] = [];
    const accounts: NormalisedAccount[] = [];
    const customers: NormalisedContact[] = [];
    const suppliers: NormalisedContact[] = [];
    const invoices: NormalisedInvoice[] = [];
    const bills: NormalisedBill[] = [];
    const tbLines: NormalisedBalance[] = [];

    for (const file of files) {
      const content = await readFile(file);
      const name = file.name.toLowerCase();

      if (name.endsWith('.iif')) {
        const { sections, warnings: iifWarnings } = parseIIF(content);
        warnings.push(...iifWarnings);

        const accSection = sections.get('ACCNT');
        if (accSection) {
          for (const row of accSection.rows) {
            if (!row['NAME']) { warnings.push('ACCNT row missing NAME — skipped'); continue; }
            accounts.push({
              sourceCode:    row['ACCNUM'] ?? '',
              sourceName:    row['NAME'],
              sourceType:    row['ACCNTTYPE'] ?? '',
              relentifyType: QB_TYPE_TO_RELENTIFY[row['ACCNTTYPE'] ?? ''] ?? 'EXPENSE',
            });
          }
        }

        const custSection = sections.get('CUST');
        if (custSection) {
          for (const row of custSection.rows) {
            if (!row['NAME']) { warnings.push('CUST row missing NAME — skipped'); continue; }
            customers.push({
              name:  row['NAME'],
              email: row['EMAIL'] || undefined,
              phone: row['PHONE1'] || undefined,
            });
          }
        }

        const vendSection = sections.get('VEND');
        if (vendSection) {
          for (const row of vendSection.rows) {
            if (!row['NAME']) { warnings.push('VEND row missing NAME — skipped'); continue; }
            suppliers.push({
              name:  row['NAME'],
              email: row['EMAIL'] || undefined,
              phone: row['PHONE1'] || undefined,
            });
          }
        }

        const trnsSection = sections.get('TRNS');
        if (trnsSection) {
          for (const row of trnsSection.rows) {
            const trnsType = (row['TRNSTYPE'] ?? '').toUpperCase();
            const rawDate = row['DATE'] ?? '';
            const issueDate = normaliseDate(rawDate);
            if (!issueDate) { warnings.push(`TRNS row has invalid DATE "${rawDate}" — skipped`); continue; }
            if (issueDate > cutoffDate) continue;

            const amount = parseFloat(row['AMOUNT'] ?? '0') || 0;
            const dueDate = normaliseDate(row['DUEDATE'] ?? '') ?? issueDate;

            if (trnsType === 'INVOICE') {
              if (!row['NAME']) { warnings.push('INVOICE TRNS missing NAME — skipped'); continue; }
              invoices.push({
                sourceRef:  row['DOCNUM'] ?? '',
                clientName: row['NAME'],
                issueDate,
                dueDate,
                currency:   'GBP',
                taxRate:    0,
                items: [{ description: row['MEMO'] || 'Imported invoice', quantity: 1, unitPrice: amount, taxRate: 0 }],
                status: 'IMPORTED',
              });
            } else if (trnsType === 'BILL') {
              if (!row['NAME']) { warnings.push('BILL TRNS missing NAME — skipped'); continue; }
              bills.push({
                sourceRef:    row['DOCNUM'] ?? '',
                supplierName: row['NAME'],
                issueDate,
                dueDate,
                currency:     'GBP',
                amount:       Math.abs(amount),
                vatAmount:    0,
                vatRate:      0,
                category:     'general',
              });
            }
          }
        }
      } else if (name.endsWith('.csv')) {
        const rows = Papa.parse<Record<string, string>>(content, {
          header: true, skipEmptyLines: true,
          transformHeader: (h: string) => h.trim(),
          transform: (v: string) => v.trim(),
        }).data;

        if (name.includes('account')) {
          for (const row of rows) {
            accounts.push({
              sourceCode:    row['Account Code'] ?? row['Number'] ?? '',
              sourceName:    row['Account Name'] ?? row['Name'] ?? '',
              sourceType:    row['Account Type'] ?? row['Type'] ?? '',
              relentifyType: QB_TYPE_TO_RELENTIFY[row['Account Type'] ?? ''] ?? 'EXPENSE',
            });
          }
        } else if (name.includes('customer')) {
          for (const row of rows) {
            const n = row['Customer Name'] ?? row['Name'] ?? '';
            if (!n) continue;
            customers.push({ name: n, email: row['Email'] || undefined });
          }
        } else if (name.includes('vendor') || name.includes('supplier')) {
          for (const row of rows) {
            const n = row['Vendor Name'] ?? row['Name'] ?? '';
            if (!n) continue;
            suppliers.push({ name: n, email: row['Email'] || undefined });
          }
        } else if (name.includes('trial_balance') || name.includes('trial balance')) {
          for (const row of rows) {
            const code = parseInt(row['Account Code'] ?? row['AccountCode'] ?? '', 10);
            if (isNaN(code)) continue;
            tbLines.push({
              accountCode: code,
              debit:  parseFloat(row['Debit'] ?? '0') || 0,
              credit: parseFloat(row['Credit'] ?? '0') || 0,
            });
          }
        }
      }
    }

    const totalDebits  = tbLines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = tbLines.reduce((s, l) => s + l.credit, 0);
    const trialBalance: NormalisedTrialBalance = { totalDebits, totalCredits, lines: tbLines };

    return { accounts, customers, suppliers, invoices, bills, openingBalances: tbLines, trialBalance, parseWarnings: warnings };
  }
}
