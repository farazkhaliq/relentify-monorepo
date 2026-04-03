import { query } from '@/src/lib/db';
import { getProfitAndLoss } from '@/src/lib/general_ledger.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns the start of the current financial year as an ISO date string.
 *  Uses last_fy_end_date + 1 day. Falls back to Jan 1 of current year. */
export function getFYStart(lastFYEndDate: string | null): string {
  if (lastFYEndDate) {
    const d = new Date(lastFYEndDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return `${new Date().getFullYear()}-01-01`;
}

/** Returns a label like "JAN–MAR" for the range fyStart → today. */
export function getPeriodLabel(fyStart: string): string {
  const start = new Date(fyStart);
  const end = new Date();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const s = months[start.getMonth()];
  const e = months[end.getMonth()];
  return s === e ? s : `${s}–${e}`;
}

/** Shifts a YYYY-MM-DD date back by exactly one year. */
export function shiftYearBack(iso: string): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface DailyBalancePoint {
  date: string;   // YYYY-MM-DD
  balance: number;
}

export interface MonthlyCashflowPoint {
  month: string;       // e.g. "Mar" or "Next 30d"
  monthKey: string;    // YYYY-MM for sorting, "forecast" for the projection bar
  moneyIn: number;
  moneyOut: number;
  isForecast: boolean;
  isPartial: boolean;  // current month MTD
}

export interface ForecastInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  total: number;
  due_date: string;
}

export interface ForecastBill {
  id: string;
  supplier_name: string | null;
  amount: number;
  due_date: string;
}

export interface DashboardData {
  // Net position
  bankBalance: number;
  hasBankConnection: boolean;
  totalReceivables: number;
  totalPayables: number;
  // Profit (only populated when hasReports=true)
  profitYTD: number;
  profitSamePeriodLastYear: number;
  profitPeriodLabel: string;
  fyStart: string;
  // Forecast
  forecastIncome: number;
  forecastSpend: number;
  forecastInvoices: ForecastInvoice[];
  forecastBills: ForecastBill[];
  // Charts (only populated when hasBankConnection=true)
  dailyBalance: DailyBalancePoint[];
  monthlyCashflow: MonthlyCashflowPoint[];
  // Alerts
  overdueInvoiceCount: number;
  billsDueSoonCount: number;
  unmatchedTxCount: number;
}

// ─── main function ────────────────────────────────────────────────────────────

export async function getDashboardData(
  userId: string,
  entityId: string,
  opts: { hasReports: boolean; lastFYEndDate: string | null }
): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);

  const fyStart = getFYStart(opts.lastFYEndDate);
  const periodLabel = getPeriodLabel(fyStart);

  const [
    bankRow,
    receivablesRow,
    payablesRow,
    overdueRow,
    billsDueRow,
    unmatchedRow,
    forecastIncomeRow,
    forecastSpendRow,
    forecastInvoicesRow,
    forecastBillsRow,
  ] = await Promise.all([
    // Bank balance + connection check
    query(
      `SELECT COALESCE(SUM(balance), 0) AS balance,
              COUNT(*) > 0 AS has_connection
       FROM acc_bank_connections
       WHERE user_id = $1 AND entity_id = $2`,
      [userId, entityId]
    ),
    // Total receivables
    query(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM acc_invoices
       WHERE user_id = $1 AND entity_id = $2 AND status IN ('sent','overdue')`,
      [userId, entityId]
    ),
    // Total payables
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM acc_bills
       WHERE user_id = $1 AND entity_id = $2 AND status = 'unpaid'`,
      [userId, entityId]
    ),
    // Overdue invoice count
    query(
      `SELECT COUNT(*) AS count
       FROM acc_invoices
       WHERE user_id = $1 AND entity_id = $2 AND status = 'overdue'`,
      [userId, entityId]
    ),
    // Bills due within 7 days
    query(
      `SELECT COUNT(*) AS count
       FROM acc_bills
       WHERE user_id = $1 AND entity_id = $2
         AND status = 'unpaid'
         AND due_date >= $3 AND due_date <= $4`,
      [userId, entityId, today, in7Days]
    ),
    // Unmatched bank transactions
    query(
      `SELECT COUNT(*) AS count
       FROM acc_bank_transactions
       WHERE user_id = $1 AND entity_id = $2 AND status = 'unmatched'`,
      [userId, entityId]
    ),
    // Forecast income total
    query(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM acc_invoices
       WHERE user_id = $1 AND entity_id = $2
         AND status IN ('sent','overdue')
         AND due_date >= $3 AND due_date <= $4`,
      [userId, entityId, today, in30Days]
    ),
    // Forecast spend total
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM acc_bills
       WHERE user_id = $1 AND entity_id = $2
         AND status = 'unpaid'
         AND due_date >= $3 AND due_date <= $4`,
      [userId, entityId, today, in30Days]
    ),
    // Forecast invoice list (drill-down)
    query(
      `SELECT id, invoice_number, client_name, total, due_date
       FROM acc_invoices
       WHERE user_id = $1 AND entity_id = $2
         AND status IN ('sent','overdue')
         AND due_date >= $3 AND due_date <= $4
       ORDER BY due_date ASC`,
      [userId, entityId, today, in30Days]
    ),
    // Forecast bill list (drill-down)
    query(
      `SELECT id, supplier_name, amount, due_date
       FROM acc_bills
       WHERE user_id = $1 AND entity_id = $2
         AND status = 'unpaid'
         AND due_date >= $3 AND due_date <= $4
       ORDER BY due_date ASC`,
      [userId, entityId, today, in30Days]
    ),
  ]);

  const bankBalance = parseFloat(bankRow.rows[0]?.balance ?? '0');
  const hasBankConnection =
    bankRow.rows[0]?.has_connection === true ||
    bankRow.rows[0]?.has_connection === 't';

  const forecastIncome = parseFloat(forecastIncomeRow.rows[0]?.total ?? '0');
  const forecastSpend = parseFloat(forecastSpendRow.rows[0]?.total ?? '0');

  // Profit: only if real_time_reports
  let profitYTD = 0;
  let profitSamePeriodLastYear = 0;

  if (opts.hasReports) {
    const priorStart = shiftYearBack(fyStart);
    const priorEnd = shiftYearBack(today);
    const [currentPnL, priorPnL] = await Promise.all([
      getProfitAndLoss(entityId, fyStart, today),
      getProfitAndLoss(entityId, priorStart, priorEnd),
    ]);
    profitYTD = currentPnL.netProfit;
    profitSamePeriodLastYear = priorPnL.netProfit;
  }

  // Charts: only query if bank connected
  let dailyBalance: DailyBalancePoint[] = [];
  let monthlyCashflow: MonthlyCashflowPoint[] = [];

  if (hasBankConnection) {
    const [dailyBalanceRow, monthlyCashflowRow] = await Promise.all([
      // Daily balance: for each day in last 6 months, compute
      // currentBalance − sum of transactions that occurred AFTER that day.
      // This correctly reconstructs historical balances from the current known balance.
      query(
        `SELECT
           d.date::text AS date,
           $3 - COALESCE(
             SUM(
               CASE WHEN bt.type = 'credit' THEN bt.amount
                    WHEN bt.type = 'debit'  THEN -bt.amount
                    ELSE 0 END
             ), 0
           ) AS balance
         FROM generate_series(
           $1::date,
           $2::date,
           '1 day'::interval
         ) AS d(date)
         LEFT JOIN acc_bank_transactions bt
           ON bt.user_id = $4
           AND bt.entity_id = $5
           AND bt.transaction_date > d.date
           AND bt.transaction_date <= $2::date
         GROUP BY d.date
         ORDER BY d.date ASC`,
        [sixMonthsAgo, today, bankBalance, userId, entityId]
      ),
      // Monthly cashflow: last 11 complete months + current month MTD
      query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', transaction_date), 'YYYY-MM') AS month_key,
           TO_CHAR(DATE_TRUNC('month', transaction_date), 'Mon')     AS month_label,
           DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE) AS is_partial,
           COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS money_in,
           COALESCE(SUM(CASE WHEN type = 'debit'  THEN amount ELSE 0 END), 0) AS money_out
         FROM acc_bank_transactions
         WHERE user_id = $1 AND entity_id = $2
           AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
         GROUP BY DATE_TRUNC('month', transaction_date)
         ORDER BY DATE_TRUNC('month', transaction_date) ASC`,
        [userId, entityId]
      ),
    ]);

    dailyBalance = dailyBalanceRow.rows.map((r: any) => ({
      date: r.date,
      balance: parseFloat(r.balance ?? '0'),
    }));

    monthlyCashflow = monthlyCashflowRow.rows.map((r: any) => ({
      month: r.month_label,
      monthKey: r.month_key,
      moneyIn: parseFloat(r.money_in ?? '0'),
      moneyOut: parseFloat(r.money_out ?? '0'),
      isForecast: false,
      isPartial: r.is_partial === true || r.is_partial === 't',
    }));

    // Append the forecast bar (next 30 days)
    monthlyCashflow.push({
      month: 'Next 30d',
      monthKey: 'forecast',
      moneyIn: forecastIncome,
      moneyOut: forecastSpend,
      isForecast: true,
      isPartial: false,
    });
  }

  return {
    bankBalance,
    hasBankConnection,
    totalReceivables: parseFloat(receivablesRow.rows[0]?.total ?? '0'),
    totalPayables: parseFloat(payablesRow.rows[0]?.total ?? '0'),
    profitYTD,
    profitSamePeriodLastYear,
    profitPeriodLabel: periodLabel,
    fyStart,
    forecastIncome,
    forecastSpend,
    forecastInvoices: forecastInvoicesRow.rows.map((r: any) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      client_name: r.client_name,
      total: parseFloat(r.total),
      due_date: r.due_date,
    })),
    forecastBills: forecastBillsRow.rows.map((r: any) => ({
      id: r.id,
      supplier_name: r.supplier_name,
      amount: parseFloat(r.amount),
      due_date: r.due_date,
    })),
    dailyBalance,
    monthlyCashflow,
    overdueInvoiceCount: parseInt(overdueRow.rows[0]?.count ?? '0', 10),
    billsDueSoonCount: parseInt(billsDueRow.rows[0]?.count ?? '0', 10),
    unmatchedTxCount: parseInt(unmatchedRow.rows[0]?.count ?? '0', 10),
  };
}
