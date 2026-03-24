// lib/services/year_end.service.ts
import { query } from './db';
import { getAccountByCode } from './chart_of_accounts.service';
import { postJournalEntry } from './general_ledger.service';

export interface YearEndPreviewLine {
  accountCode: number;
  accountName: string;
  accountType: string;
  closingDebit: number;
  closingCredit: number;
}

export interface YearEndPreview {
  yearEndDate: string;
  lines: YearEndPreviewLine[];
  netProfit: number;       // positive = profit, negative = loss
  retainedEarningsCode: number;
}

/** Calculate closing journal lines for a year-end close without posting */
export async function previewYearEndClose(
  entityId: string,
  yearEndDate: string     // YYYY-MM-DD (inclusive last day of FY)
): Promise<YearEndPreview> {
  // Determine FY start: we close ALL P&L balances up to yearEndDate
  // We use the full cumulative balance because each year-end close zeroes them out.
  // The previous year-end lock means prior-period balances are already zeroed.
  const r = await query(
    `SELECT
       coa.code,
       coa.name,
       coa.account_type,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS net
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id
       AND je.entity_id = $1
       AND je.entry_date <= $2
     WHERE coa.entity_id = $1
       AND coa.account_type IN ('INCOME', 'COGS', 'EXPENSE')
     GROUP BY coa.code, coa.name, coa.account_type
     HAVING COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) != 0
     ORDER BY coa.code ASC`,
    [entityId, yearEndDate]
  );

  const lines: YearEndPreviewLine[] = [];
  let netProfit = 0;

  for (const row of r.rows) {
    const net = parseFloat(row.net);
    // INCOME: credit balance (net is negative) — to zero, debit it
    // COGS/EXPENSE: debit balance (net is positive) — to zero, credit it
    if (row.account_type === 'INCOME') {
      // net is negative for income (credits > debits)
      // Closing entry: Dr Income account (abs(net)), Cr Retained Earnings
      const closingDebit = Math.abs(net);
      lines.push({ accountCode: row.code, accountName: row.name, accountType: row.account_type, closingDebit, closingCredit: 0 });
      netProfit += closingDebit;
    } else {
      // COGS or EXPENSE: net is positive (debits > credits)
      // Closing entry: Cr Expense/COGS account (net), Dr Retained Earnings
      lines.push({ accountCode: row.code, accountName: row.name, accountType: row.account_type, closingDebit: 0, closingCredit: net });
      netProfit -= net;
    }
  }

  return { yearEndDate, lines, netProfit, retainedEarningsCode: 3001 };
}

/** Post the year-end close journal and update entity */
export async function runYearEndClose(
  entityId: string,
  userId: string,
  yearEndDate: string     // YYYY-MM-DD
): Promise<{ journalEntryId: string; lockedThroughDate: string; netProfit: number }> {
  const preview = await previewYearEndClose(entityId, yearEndDate);

  const retainedEarnings = await getAccountByCode(entityId, 3001);
  if (!retainedEarnings) throw new Error('Retained Earnings account (3001) not found — run COA seed');

  // Build journal lines
  const journalLines: { accountId: string; description: string; debit: number; credit: number }[] = [];

  for (const line of preview.lines) {
    const acct = await getAccountByCode(entityId, line.accountCode);
    if (!acct) throw new Error(`Account ${line.accountCode} not found`);
    journalLines.push({
      accountId: acct.id,
      description: `Year-end close — ${line.accountName}`,
      debit: line.closingDebit,
      credit: line.closingCredit,
    });
  }

  // Retained earnings line (balancing entry)
  const { netProfit } = preview;
  if (netProfit > 0) {
    // Profit: Cr Retained Earnings
    journalLines.push({ accountId: retainedEarnings.id, description: 'Year-end retained earnings', debit: 0, credit: netProfit });
  } else if (netProfit < 0) {
    // Loss: Dr Retained Earnings
    journalLines.push({ accountId: retainedEarnings.id, description: 'Year-end retained earnings (loss)', debit: Math.abs(netProfit), credit: 0 });
  } else {
    // Break-even: still need a line to make the entry valid if there are any lines
    // Only needed if journalLines is non-empty
    if (journalLines.length > 0) {
      journalLines.push({ accountId: retainedEarnings.id, description: 'Year-end retained earnings (break-even)', debit: 0, credit: 0 });
    }
  }

  if (journalLines.length < 2) {
    throw new Error('No P&L balances found for this period — nothing to close.');
  }

  const journalEntryId = await postJournalEntry({
    entityId,
    userId,
    date: yearEndDate,
    reference: `YE-${yearEndDate}`,
    description: `Year-end close — ${yearEndDate}`,
    sourceType: 'year_end_close',
    lines: journalLines,
  });

  // Update last_fy_end_date on entity
  await query(
    'UPDATE entities SET last_fy_end_date = $1 WHERE id = $2',
    [yearEndDate, entityId]
  );

  // Auto-lock: MAX(yearEndDate, current locked_through_date)
  const entityRes = await query('SELECT locked_through_date FROM entities WHERE id=$1', [entityId]);
  const currentLock: string | null = entityRes.rows[0]?.locked_through_date ?? null;

  let newLockDate = yearEndDate;
  if (currentLock && currentLock > yearEndDate) {
    newLockDate = currentLock; // don't move lock backwards
  }

  await query(
    'UPDATE entities SET locked_through_date = $1 WHERE id = $2',
    [newLockDate, entityId]
  );

  return { journalEntryId, lockedThroughDate: newLockDate, netProfit };
}
