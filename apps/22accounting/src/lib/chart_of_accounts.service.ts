import { query } from './db';

// COA range → type enforcement
const TYPE_RANGES: Record<string, [number, number]> = {
  ASSET:     [1000, 1999],
  LIABILITY: [2000, 2999],
  EQUITY:    [3000, 3999],
  INCOME:    [4000, 4999],
  COGS:      [5000, 6999],
  EXPENSE:   [7000, 9998],
  SUSPENSE:  [9999, 9999],
};

export function validateCodeForType(code: number, accountType: string): string | null {
  const range = TYPE_RANGES[accountType];
  if (!range) return `Unknown account type: ${accountType}`;
  if (code < range[0] || code > range[1]) {
    return `Code ${code} is out of range for ${accountType} accounts (${range[0]}–${range[1]})`;
  }
  return null;
}

// Full default UK COA — seeded per entity on creation
const DEFAULT_COA = [
  // Assets 1000-1999
  { code: 1100, name: 'Accounts Receivable (Debtors Control)', type: 'ASSET',     system: true,  desc: 'Amounts owed by customers' },
  { code: 1200, name: 'Current Account',                        type: 'ASSET',     system: true,  desc: 'Main business bank account' },
  { code: 1201, name: 'VAT Input Tax',                          type: 'ASSET',     system: true,  desc: 'Reclaimable VAT on purchases' },
  { code: 1210, name: 'Business Savings Account',               type: 'ASSET',     system: false, desc: 'Business savings or deposit account' },
  { code: 1220, name: 'Cash in Hand',                           type: 'ASSET',     system: false, desc: 'Petty cash and cash on hand' },
  { code: 1700, name: 'Office Equipment',                       type: 'ASSET',     system: false, desc: 'Office furniture and equipment' },
  { code: 1710, name: 'Computer Equipment',                     type: 'ASSET',     system: false, desc: 'Computers, servers, IT hardware' },
  // Liabilities 2000-2999
  { code: 2100, name: 'Accounts Payable (Creditors Control)',   type: 'LIABILITY', system: true,  desc: 'Amounts owed to suppliers' },
  { code: 2110, name: 'Employee Reimbursements Payable',        type: 'LIABILITY', system: true,  desc: 'Expenses and mileage owed to employees' },
  { code: 2202, name: 'VAT Output Tax',                         type: 'LIABILITY', system: true,  desc: 'VAT collected on sales, payable to HMRC' },
  { code: 2210, name: 'PAYE / NI Payable',                      type: 'LIABILITY', system: false, desc: 'PAYE and National Insurance due to HMRC' },
  { code: 2300, name: 'Corporation Tax Payable',                type: 'LIABILITY', system: false, desc: 'Corporation tax liability' },
  { code: 2301, name: "Director's Loan Account",                type: 'LIABILITY', system: false, desc: "Director's loan to/from the company" },
  // Equity 3000-3999
  { code: 3000, name: 'Share Capital',                          type: 'EQUITY',    system: false, desc: 'Capital invested by shareholders' },
  { code: 3001, name: 'Retained Earnings',                      type: 'EQUITY',    system: false, desc: 'Accumulated profits retained in the business' },
  // Income 4000-4999
  { code: 4000, name: 'Sales - General',                        type: 'INCOME',    system: true,  desc: 'General sales income' },
  { code: 4001, name: 'Sales - Services',                       type: 'INCOME',    system: false, desc: 'Income from services rendered' },
  { code: 4002, name: 'Sales - Products',                       type: 'INCOME',    system: false, desc: 'Income from product sales' },
  { code: 4900, name: 'Other Income',                           type: 'INCOME',    system: false, desc: 'Miscellaneous income not elsewhere classified' },
  // COGS 5000-6999
  { code: 5000, name: 'Cost of Goods Sold',                     type: 'COGS',      system: false, desc: 'Direct cost of goods sold' },
  { code: 5001, name: 'Direct Materials',                       type: 'COGS',      system: false, desc: 'Raw materials and components' },
  { code: 5100, name: 'Direct Labour / Subcontractors',         type: 'COGS',      system: false, desc: 'Labour directly attributable to production' },
  { code: 6000, name: 'Other Direct Costs',                     type: 'COGS',      system: false, desc: 'Other costs directly attributable to sales' },
  // Overheads 7000-9998
  { code: 7000, name: 'Wages & Salaries',                       type: 'EXPENSE',   system: false, desc: 'Employee wages and salaries' },
  { code: 7100, name: 'Advertising & Marketing',                type: 'EXPENSE',   system: false, desc: 'Advertising, marketing, and promotions' },
  { code: 7200, name: 'Entertainment & Hospitality',            type: 'EXPENSE',   system: false, desc: 'Client entertainment and business meals' },
  { code: 7300, name: 'Travel & Accommodation',                 type: 'EXPENSE',   system: false, desc: 'Business travel and hotel costs' },
  { code: 7304, name: 'Motor Expenses & Mileage',               type: 'EXPENSE',   system: false, desc: 'Vehicle running costs and mileage claims' },
  { code: 7400, name: 'Office Costs & Stationery',              type: 'EXPENSE',   system: false, desc: 'Office supplies and stationery' },
  { code: 7500, name: 'IT & Software Subscriptions',            type: 'EXPENSE',   system: false, desc: 'Software licenses and SaaS subscriptions' },
  { code: 7600, name: 'Professional Fees & Consultancy',        type: 'EXPENSE',   system: false, desc: 'Accountancy, legal, and consulting fees' },
  { code: 7700, name: 'Bank Charges & Finance Costs',           type: 'EXPENSE',   system: false, desc: 'Bank fees, interest charges, finance costs' },
  { code: 7800, name: 'Depreciation',                           type: 'EXPENSE',   system: false, desc: 'Depreciation of fixed assets' },
  { code: 7900, name: 'General Expenses',                       type: 'EXPENSE',   system: false, desc: 'Miscellaneous business expenses' },
  { code: 8000, name: 'Insurance',                              type: 'EXPENSE',   system: false, desc: 'Business insurance premiums' },
  { code: 8100, name: 'Rent & Rates',                           type: 'EXPENSE',   system: false, desc: 'Office rent and business rates' },
  { code: 8200, name: 'Repairs & Maintenance',                  type: 'EXPENSE',   system: false, desc: 'Maintenance and repair costs' },
  { code: 8300, name: 'Subscriptions & Memberships',            type: 'EXPENSE',   system: false, desc: 'Professional subscriptions and memberships' },
  { code: 8400, name: 'Utilities',                              type: 'EXPENSE',   system: false, desc: 'Gas, electricity, and water' },
  { code: 8500, name: 'Telephone & Internet',                   type: 'EXPENSE',   system: false, desc: 'Phone bills and broadband' },
  { code: 9000, name: 'Interest Paid',                          type: 'EXPENSE',   system: false, desc: 'Interest on loans and overdrafts' },
  // Suspense
  { code: 9999, name: 'Suspense Account',                       type: 'SUSPENSE',  system: true,  desc: 'Temporary holding account for unclassified transactions' },
];

export async function seedDefaultCOA(entityId: string): Promise<void> {
  // Check if already seeded
  const existing = await query('SELECT id FROM acc_chart_of_accounts WHERE entity_id=$1 LIMIT 1', [entityId]);
  if (existing.rows.length > 0) return;

  for (const acct of DEFAULT_COA) {
    await query(
      `INSERT INTO acc_chart_of_accounts (entity_id, code, name, account_type, description, is_system)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (entity_id, code) DO NOTHING`,
      [entityId, acct.code, acct.name, acct.type, acct.desc, acct.system]
    );
  }
}

export async function getChartOfAccounts(entityId: string) {
  const r = await query(
    `SELECT id, code, name, account_type, description, is_active, is_system,
            COALESCE(
              (SELECT SUM(jl.debit) - SUM(jl.credit)
               FROM acc_journal_lines jl
               JOIN acc_journal_entries je ON jl.entry_id = je.id
               WHERE jl.account_id = coa.id AND je.entity_id = $1),
              0
            ) AS balance
     FROM acc_chart_of_accounts coa
     WHERE entity_id = $1
     ORDER BY code ASC`,
    [entityId]
  );
  return r.rows;
}

export async function getAccountById(id: string, entityId: string) {
  const r = await query(
    'SELECT * FROM acc_chart_of_accounts WHERE id=$1 AND entity_id=$2',
    [id, entityId]
  );
  return r.rows[0] || null;
}

export async function getAccountByCode(entityId: string, code: number) {
  const r = await query(
    'SELECT * FROM acc_chart_of_accounts WHERE entity_id=$1 AND code=$2 AND is_active=TRUE',
    [entityId, code]
  );
  return r.rows[0] || null;
}

// All active accounts suitable for showing in dropdowns (all 1000-9999)
export async function getAllActiveAccounts(entityId: string) {
  const r = await query(
    `SELECT id, code, name, account_type, description
     FROM acc_chart_of_accounts
     WHERE entity_id=$1 AND is_active=TRUE
     ORDER BY code ASC`,
    [entityId]
  );
  return r.rows;
}

// Convenience: expense-type accounts for recommended default on bills
export async function getExpenseAccounts(entityId: string) {
  const r = await query(
    `SELECT id, code, name, account_type
     FROM acc_chart_of_accounts
     WHERE entity_id=$1 AND is_active=TRUE
       AND account_type IN ('COGS','EXPENSE','SUSPENSE')
     ORDER BY code ASC`,
    [entityId]
  );
  return r.rows;
}

export async function createAccount(entityId: string, data: {
  code: number;
  name: string;
  accountType: string;
  description?: string;
}) {
  const err = validateCodeForType(data.code, data.accountType);
  if (err) throw new Error(err);

  const r = await query(
    `INSERT INTO acc_chart_of_accounts (entity_id, code, name, account_type, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [entityId, data.code, data.name, data.accountType, data.description || null]
  );
  return r.rows[0];
}

export async function updateAccount(id: string, entityId: string, data: {
  name?: string;
  description?: string;
}) {
  const acct = await getAccountById(id, entityId);
  if (!acct) throw new Error('Account not found');
  // System accounts: can only update description, not name
  const r = await query(
    `UPDATE acc_chart_of_accounts
     SET name        = COALESCE($3, name),
         description = COALESCE($4, description)
     WHERE id=$1 AND entity_id=$2 RETURNING *`,
    [id, entityId, data.name || null, data.description !== undefined ? data.description : null]
  );
  return r.rows[0];
}

export async function deactivateAccount(id: string, entityId: string) {
  const acct = await getAccountById(id, entityId);
  if (!acct) throw new Error('Account not found');
  if (acct.is_system) throw new Error('System accounts cannot be deactivated');

  // Check if account has any journal lines
  const usage = await query(
    `SELECT COUNT(*) FROM acc_journal_lines jl
     JOIN acc_journal_entries je ON jl.entry_id = je.id
     WHERE jl.account_id = $1 AND je.entity_id = $2`,
    [id, entityId]
  );
  if (parseInt(usage.rows[0].count) > 0) {
    throw new Error('Cannot deactivate an account that has posted transactions');
  }

  await query('UPDATE acc_chart_of_accounts SET is_active=FALSE WHERE id=$1', [id]);
}
