import { query } from './db';
import { getAccountByCode } from './chart_of_accounts.service';

export interface JournalLine {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface PostJournalEntryParams {
  entityId: string;
  userId: string;
  date: string;           // YYYY-MM-DD
  reference?: string;
  description?: string;
  sourceType?: string;    // invoice | bill | expense | mileage | payment | manual
  sourceId?: string;
  lines: JournalLine[];
}

export async function postJournalEntry(params: PostJournalEntryParams): Promise<string> {
  const { entityId, userId, date, reference, description, sourceType, sourceId, lines } = params;

  // Validate balance: sum(debit) must equal sum(credit)
  const totalDebit  = lines.reduce((s, l) => s + (l.debit  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.005) {
    throw new Error(
      `Journal entry does not balance: debits £${totalDebit.toFixed(2)} ≠ credits £${totalCredit.toFixed(2)}`
    );
  }

  if (lines.length < 2) throw new Error('Journal entry must have at least 2 lines');

  // Insert entry
  const entryRes = await query(
    `INSERT INTO journal_entries
       (entity_id, user_id, entry_date, reference, description, source_type, source_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [entityId, userId, date, reference || null, description || null, sourceType || null, sourceId || null]
  );
  const entryId = entryRes.rows[0].id as string;

  // Insert lines
  for (const line of lines) {
    await query(
      `INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
       VALUES ($1,$2,$3,$4,$5)`,
      [entryId, line.accountId, line.description || null,
       parseFloat((line.debit  || 0).toFixed(2)),
       parseFloat((line.credit || 0).toFixed(2))]
    );
  }

  return entryId;
}

export async function reverseJournalEntry(
  originalEntryId: string,
  userId: string,
  date: string
): Promise<string> {
  // Fetch original entry + lines
  const entryRes = await query(
    'SELECT * FROM journal_entries WHERE id=$1', [originalEntryId]
  );
  const original = entryRes.rows[0];
  if (!original) throw new Error('Original journal entry not found');

  const linesRes = await query(
    'SELECT * FROM journal_lines WHERE entry_id=$1', [originalEntryId]
  );

  // Reverse: swap debit/credit on every line
  const reversedLines: JournalLine[] = linesRes.rows.map(l => ({
    accountId:   l.account_id,
    description: `Reversal: ${l.description || ''}`,
    debit:       parseFloat(l.credit),
    credit:      parseFloat(l.debit),
  }));

  return postJournalEntry({
    entityId:    original.entity_id,
    userId,
    date,
    reference:   `REV-${original.reference || originalEntryId.slice(0, 8)}`,
    description: `Reversal of: ${original.description || originalEntryId}`,
    sourceType:  'manual',
    sourceId:    originalEntryId,
    lines:       reversedLines,
  });
}

export async function getJournalEntries(
  entityId: string,
  filters: { from?: string; to?: string; accountCode?: number; sourceType?: string }
) {
  let sql = `
    SELECT
      je.id, je.entry_date, je.reference, je.description,
      je.source_type, je.source_id, je.is_locked, je.created_at,
      json_agg(json_build_object(
        'id',          jl.id,
        'accountId',   jl.account_id,
        'accountCode', coa.code,
        'accountName', coa.name,
        'accountType', coa.account_type,
        'description', jl.description,
        'debit',       jl.debit,
        'credit',      jl.credit
      ) ORDER BY coa.code) AS lines
    FROM journal_entries je
    JOIN journal_lines jl ON jl.entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE je.entity_id = $1
  `;
  const params: (string | number)[] = [entityId];

  if (filters.from) {
    params.push(filters.from);
    sql += ` AND je.entry_date >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    sql += ` AND je.entry_date <= $${params.length}`;
  }
  if (filters.sourceType) {
    params.push(filters.sourceType);
    sql += ` AND je.source_type = $${params.length}`;
  }
  if (filters.accountCode) {
    params.push(filters.accountCode);
    sql += ` AND coa.code = $${params.length}`;
  }

  sql += ' GROUP BY je.id ORDER BY je.entry_date DESC, je.created_at DESC';

  const r = await query(sql, params);
  return r.rows;
}

export async function getTrialBalance(entityId: string, asOf?: string) {
  let dateFilter = '';
  const params: (string)[] = [entityId];
  if (asOf) {
    params.push(asOf);
    dateFilter = `AND je.entry_date <= $${params.length}`;
  }

  const r = await query(
    `SELECT
       coa.id,
       coa.code,
       coa.name,
       coa.account_type,
       COALESCE(SUM(jl.debit),  0) AS total_debit,
       COALESCE(SUM(jl.credit), 0) AS total_credit,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS net
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id
       AND je.entity_id = $1 ${dateFilter}
     WHERE coa.entity_id = $1
     GROUP BY coa.id, coa.code, coa.name, coa.account_type
     ORDER BY coa.code ASC`,
    params
  );

  const rows = r.rows;
  const grandDebit  = rows.reduce((s: number, row: { total_debit: string }) => s + parseFloat(row.total_debit),  0);
  const grandCredit = rows.reduce((s: number, row: { total_credit: string }) => s + parseFloat(row.total_credit), 0);

  return { rows, grandDebit, grandCredit, balanced: Math.abs(grandDebit - grandCredit) < 0.01 };
}

export async function getProfitAndLoss(entityId: string, from: string, to: string) {
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
       AND je.entry_date >= $2
       AND je.entry_date <= $3
     WHERE coa.entity_id = $1
       AND coa.account_type IN ('INCOME','COGS','EXPENSE')
     GROUP BY coa.code, coa.name, coa.account_type
     HAVING COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) != 0
        OR  coa.account_type = 'INCOME'
     ORDER BY coa.code ASC`,
    [entityId, from, to]
  );

  const rows = r.rows;

  // Income: net is negative (credits > debits on income accounts)
  // We flip sign for income so it shows as a positive number in the P&L
  const income  = rows.filter((r: { account_type: string }) => r.account_type === 'INCOME')
    .map((r: { code: number; name: string; account_type: string; net: string }) => ({
      ...r, net: -parseFloat(r.net)    // flip: credits are income
    }));
  const cogs    = rows.filter((r: { account_type: string }) => r.account_type === 'COGS')
    .map((r: { code: number; name: string; account_type: string; net: string }) => ({ ...r, net: parseFloat(r.net) }));
  const expense = rows.filter((r: { account_type: string }) => r.account_type === 'EXPENSE')
    .map((r: { code: number; name: string; account_type: string; net: string }) => ({ ...r, net: parseFloat(r.net) }));

  const totalIncome  = income.reduce((s: number, r: { net: number }) => s + r.net, 0);
  const totalCOGS    = cogs.reduce((s: number, r: { net: number }) => s + r.net, 0);
  const grossProfit  = totalIncome - totalCOGS;
  const totalExpense = expense.reduce((s: number, r: { net: number }) => s + r.net, 0);
  const netProfit    = grossProfit - totalExpense;

  return { income, cogs, expense, totalIncome, totalCOGS, grossProfit, totalExpense, netProfit };
}

export async function getBalanceSheet(entityId: string, asOf?: string) {
  let dateFilter = '';
  const params: string[] = [entityId];
  if (asOf) {
    params.push(asOf);
    dateFilter = `AND je.entry_date <= $${params.length}`;
  }

  const r = await query(
    `SELECT
       coa.code,
       coa.name,
       coa.account_type,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS net
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id
       AND je.entity_id = $1 ${dateFilter}
     WHERE coa.entity_id = $1
       AND coa.account_type IN ('ASSET','LIABILITY','EQUITY')
     GROUP BY coa.code, coa.name, coa.account_type
     ORDER BY coa.code ASC`,
    params
  );

  const rows = r.rows;
  const assets      = rows.filter((r: { account_type: string }) => r.account_type === 'ASSET')
    .map((r: { code: number; name: string; account_type: string; net: string }) => ({ ...r, net: parseFloat(r.net) }));
  const liabilities = rows.filter((r: { account_type: string }) => r.account_type === 'LIABILITY')
    .map((r: { code: number; name: string; account_type: string; net: string }) => ({ ...r, net: -parseFloat(r.net) }));  // flip sign
  const equity      = rows.filter((r: { account_type: string }) => r.account_type === 'EQUITY')
    .map((r: { code: number; name: string; account_type: string; net: string }) => ({ ...r, net: -parseFloat(r.net) }));  // flip sign

  return {
    assets,
    liabilities,
    equity,
    totalAssets:      assets.reduce((s: number, r: { net: number }) => s + r.net, 0),
    totalLiabilities: liabilities.reduce((s: number, r: { net: number }) => s + r.net, 0),
    totalEquity:      equity.reduce((s: number, r: { net: number }) => s + r.net, 0),
  };
}

// Helper: build GL lines for an invoice being created
export async function buildInvoiceCreationLines(
  entityId: string,
  invoiceTotal: number,
  subtotal: number,
  taxAmount: number,
  salesAccountId?: string
): Promise<JournalLine[]> {
  const debtors = await getAccountByCode(entityId, 1100);
  if (!debtors) throw new Error('Debtors Control account (1100) not found — run COA seed');

  const salesAcct = salesAccountId
    ? { id: salesAccountId }
    : await getAccountByCode(entityId, 4000);
  if (!salesAcct) throw new Error('Sales account (4000) not found — run COA seed');

  const lines: JournalLine[] = [
    { accountId: debtors.id, description: 'Debtors Control',  debit: invoiceTotal, credit: 0 },
    { accountId: salesAcct.id, description: 'Sales',          debit: 0, credit: subtotal },
  ];

  if (taxAmount > 0) {
    const vatOut = await getAccountByCode(entityId, 2202);
    if (vatOut) {
      lines.push({ accountId: vatOut.id, description: 'VAT Output Tax', debit: 0, credit: taxAmount });
    }
  }

  return lines;
}

// Helper: build GL lines for invoice paid
export async function buildInvoicePaymentLines(
  entityId: string,
  amount: number,
  bankAccountId?: string
): Promise<JournalLine[]> {
  const debtors = await getAccountByCode(entityId, 1100);
  const bank    = bankAccountId ? { id: bankAccountId } : await getAccountByCode(entityId, 1200);
  if (!debtors) throw new Error('Debtors Control account (1100) not found');
  if (!bank)    throw new Error('Current Account (1200) not found');

  return [
    { accountId: bank.id,    description: 'Bank receipt',     debit: amount, credit: 0 },
    { accountId: debtors.id, description: 'Debtors Control',  debit: 0, credit: amount },
  ];
}

// Helper: build GL lines for a bill being created
export async function buildBillCreationLines(
  entityId: string,
  netAmount: number,
  vatAmount: number,
  expenseAccountId: string
): Promise<JournalLine[]> {
  const creditors = await getAccountByCode(entityId, 2100);
  if (!creditors) throw new Error('Creditors Control account (2100) not found');

  const billTotal = netAmount + vatAmount;
  const lines: JournalLine[] = [
    { accountId: expenseAccountId, description: 'Purchase',         debit: netAmount,  credit: 0 },
    { accountId: creditors.id,     description: 'Creditors Control', debit: 0, credit: billTotal },
  ];

  if (vatAmount > 0) {
    const vatIn = await getAccountByCode(entityId, 1201);
    if (vatIn) {
      lines.push({ accountId: vatIn.id, description: 'VAT Input Tax', debit: vatAmount, credit: 0 });
    }
  }

  return lines;
}

// Helper: build GL lines for bill payment
export async function buildBillPaymentLines(
  entityId: string,
  amount: number,
  bankAccountId?: string
): Promise<JournalLine[]> {
  const creditors = await getAccountByCode(entityId, 2100);
  const bank      = bankAccountId ? { id: bankAccountId } : await getAccountByCode(entityId, 1200);
  if (!creditors) throw new Error('Creditors Control account (2100) not found');
  if (!bank)      throw new Error('Current Account (1200) not found');

  return [
    { accountId: creditors.id, description: 'Creditors Control', debit: amount, credit: 0 },
    { accountId: bank.id,      description: 'Bank payment',       debit: 0, credit: amount },
  ];
}

// Helper: build GL lines for expense claim
export async function buildExpenseLines(
  entityId: string,
  amount: number,
  expenseAccountId: string
): Promise<JournalLine[]> {
  const reimb = await getAccountByCode(entityId, 2110);
  if (!reimb) throw new Error('Employee Reimbursements Payable (2110) not found');

  return [
    { accountId: expenseAccountId, description: 'Expense',                   debit: amount, credit: 0 },
    { accountId: reimb.id,         description: 'Employee Reimbursement Due', debit: 0, credit: amount },
  ];
}

// Helper: build GL lines for mileage claim
export async function buildMileageLines(
  entityId: string,
  amount: number,
  mileageAccountId?: string
): Promise<JournalLine[]> {
  const reimb   = await getAccountByCode(entityId, 2110);
  const mileage = mileageAccountId ? { id: mileageAccountId } : await getAccountByCode(entityId, 7304);
  if (!reimb)   throw new Error('Employee Reimbursements Payable (2110) not found');
  if (!mileage) throw new Error('Motor Expenses & Mileage (7304) not found');

  return [
    { accountId: mileage.id, description: 'Mileage claim',              debit: amount, credit: 0 },
    { accountId: reimb.id,   description: 'Employee Reimbursement Due',  debit: 0, credit: amount },
  ];
}
