import { query } from './db';

export async function getPnLSummary(userId: string, opts: { from?: string; to?: string; entityId?: string } = {}) {
  const from = opts.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const to = opts.to || new Date().toISOString().split('T')[0];
  const entityClause = opts.entityId ? 'AND entity_id=$4' : '';
  const baseParams = opts.entityId ? [userId, from, to, opts.entityId] : [userId, from, to];

  const incomeResult = await query(
    `SELECT COALESCE(SUM(total), 0) AS total FROM invoices
     WHERE user_id = $1 AND status = 'paid' AND due_date >= $2 AND due_date <= $3 ${entityClause} AND currency = 'GBP'`,
    baseParams
  );

  const expenseResult = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM bills
     WHERE user_id = $1 AND due_date >= $2 AND due_date <= $3 ${entityClause} AND currency = 'GBP'`,
    baseParams
  );

  const income = parseFloat(incomeResult.rows[0].total);
  const expenses = parseFloat(expenseResult.rows[0].total);
  const net = income - expenses;

  return { income, expenses, net, from, to };
}

export async function getRevenueByMonth(userId: string, months = 6, entityId?: string) {
  const result: { month: string; revenue: number; expenses: number }[] = [];
  const entityClause = entityId ? 'AND entity_id=$4' : '';

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const from = d.toISOString().split('T')[0];
    const nextMonth = new Date(d);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const to = new Date(nextMonth.getTime() - 1).toISOString().split('T')[0];
    const params = entityId ? [userId, from, to, entityId] : [userId, from, to];

    const [revRow, expRow] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total), 0) AS total FROM invoices
         WHERE user_id = $1 AND status = 'paid' AND due_date >= $2 AND due_date <= $3 ${entityClause} AND currency = 'GBP'`,
        params
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM bills
         WHERE user_id = $1 AND due_date >= $2 AND due_date <= $3 ${entityClause} AND currency = 'GBP'`,
        params
      ),
    ]);

    result.push({
      month: d.toLocaleDateString('en-GB', { month: 'short' }),
      revenue: parseFloat(revRow.rows[0].total),
      expenses: parseFloat(expRow.rows[0].total),
    });
  }

  return result;
}

export async function getExpensesByCategory(userId: string, opts: { from?: string; to?: string; entityId?: string } = {}) {
  const from = opts.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const to = opts.to || new Date().toISOString().split('T')[0];
  const entityClause = opts.entityId ? 'AND entity_id=$4' : '';
  const params = opts.entityId ? [userId, from, to, opts.entityId] : [userId, from, to];

  const r = await query(
    `SELECT category, COALESCE(SUM(amount), 0) AS total
     FROM bills WHERE user_id = $1 AND due_date >= $2 AND due_date <= $3 ${entityClause} AND currency = 'GBP'
     GROUP BY category ORDER BY total DESC`,
    params
  );

  return r.rows.map(row => ({ category: row.category, total: parseFloat(row.total) }));
}

export async function getPnLDetail(userId: string, opts: { from?: string; to?: string; entityId?: string } = {}) {
  const from = opts.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const to = opts.to || new Date().toISOString().split('T')[0];
  const entityClause = opts.entityId ? 'AND entity_id=$4' : '';
  const params = opts.entityId ? [userId, from, to, opts.entityId] : [userId, from, to];

  const [invoiceRows, billRows] = await Promise.all([
    query(
      `SELECT invoice_number, client_name, due_date, total, currency FROM invoices
       WHERE user_id = $1 AND status = 'paid' AND due_date >= $2 AND due_date <= $3 ${entityClause}
       ORDER BY due_date DESC`,
      params
    ),
    query(
      `SELECT supplier_name, category, due_date, amount, currency FROM bills
       WHERE user_id = $1 AND due_date >= $2 AND due_date <= $3 ${entityClause}
       ORDER BY due_date DESC`,
      params
    ),
  ]);

  return { invoices: invoiceRows.rows, bills: billRows.rows };
}
