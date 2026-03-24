// lib/services/opening_balance.service.ts
import { query } from './db';
import { getAccountByCode } from './chart_of_accounts.service';
import { postJournalEntry } from './general_ledger.service';

export interface OpeningBalanceLine {
  accountCode: number;
  debit: number;
  credit: number;
}

export interface ImportOpeningBalancesResult {
  journalEntryId: string;
  linesImported: number;
  suspenseAmount: number; // > 0 if imbalance was auto-posted to 9999
}

/** Check if an opening balance entry already exists for this entity */
export async function getExistingOpeningBalanceEntry(entityId: string) {
  const r = await query(
    `SELECT id, entry_date FROM journal_entries
     WHERE entity_id = $1 AND source_type = 'opening_balance'
     ORDER BY created_at DESC LIMIT 1`,
    [entityId]
  );
  return r.rows[0] ?? null;
}

/** Void an existing opening balance entry by reversing it */
export async function voidOpeningBalanceEntry(entryId: string, userId: string) {
  // Fetch entry
  const entryRes = await query('SELECT * FROM journal_entries WHERE id=$1', [entryId]);
  const entry = entryRes.rows[0];
  if (!entry) throw new Error('Opening balance entry not found');

  const linesRes = await query('SELECT * FROM journal_lines WHERE entry_id=$1', [entryId]);

  // Post reversal
  const reversedLines = linesRes.rows.map((l: any) => ({
    accountId: l.account_id,
    description: `Void opening balance`,
    debit: parseFloat(l.credit),
    credit: parseFloat(l.debit),
  }));

  await postJournalEntry({
    entityId: entry.entity_id,
    userId,
    date: entry.entry_date,
    reference: 'VOID-OB',
    description: 'Void of opening balance entry',
    sourceType: 'opening_balance',
    sourceId: entryId,
    lines: reversedLines,
  });
}

/** Post opening balance lines as a single journal entry */
export async function importOpeningBalances(
  entityId: string,
  userId: string,
  asOfDate: string,        // YYYY-MM-DD
  lines: OpeningBalanceLine[]
): Promise<ImportOpeningBalancesResult> {
  // Resolve account IDs
  const resolvedLines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  for (const line of lines) {
    if (line.debit === 0 && line.credit === 0) continue; // skip zeroes

    const acct = await getAccountByCode(entityId, line.accountCode);
    if (!acct) throw new Error(`Account code ${line.accountCode} not found in your chart of accounts`);

    resolvedLines.push({
      accountId: acct.id,
      debit: line.debit,
      credit: line.credit,
      description: `Opening balance — ${acct.name}`,
    });
  }

  if (resolvedLines.length === 0) throw new Error('No non-zero lines found in upload');

  // Check balance
  const totalDebit  = resolvedLines.reduce((s, l) => s + l.debit,  0);
  const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0);
  const diff = parseFloat((totalDebit - totalCredit).toFixed(2));

  let suspenseAmount = 0;
  if (Math.abs(diff) > 0.005) {
    // Auto-balance via suspense 9999
    const suspense = await getAccountByCode(entityId, 9999);
    if (!suspense) throw new Error('Suspense account (9999) not found — run COA seed');

    suspenseAmount = Math.abs(diff);
    if (diff > 0) {
      // Debits exceed credits → credit suspense
      resolvedLines.push({ accountId: suspense.id, debit: 0, credit: diff, description: 'Opening balance suspense' });
    } else {
      // Credits exceed debits → debit suspense
      resolvedLines.push({ accountId: suspense.id, debit: Math.abs(diff), credit: 0, description: 'Opening balance suspense' });
    }
  }

  const journalEntryId = await postJournalEntry({
    entityId,
    userId,
    date: asOfDate,
    reference: 'OB',
    description: 'Opening balances',
    sourceType: 'opening_balance',
    lines: resolvedLines,
  });

  return { journalEntryId, linesImported: resolvedLines.length, suspenseAmount };
}
