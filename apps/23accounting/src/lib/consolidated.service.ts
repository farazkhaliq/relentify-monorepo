import { query } from './db';

export async function getConsolidatedPnL(userId: string, opts: { from?: string; to?: string } = {}) {
  const from = opts.from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = opts.to || new Date().toISOString().split('T')[0];

  // Get all entities for user
  const entitiesRes = await query(`SELECT id, name FROM entities WHERE user_id = $1`, [userId]);
  const entities = entitiesRes.rows;

  // Get intercompany link pairs to eliminate
  const icLinksRes = await query(
    `SELECT il.source_invoice_id, il.mirror_bill_id, il.amount
     FROM acc_intercompany_links il
     JOIN entities e ON e.id = il.initiating_entity_id
     WHERE e.user_id = $1`,
    [userId]
  );
  const icInvoiceIds = new Set(icLinksRes.rows.map((r: { source_invoice_id: string }) => r.source_invoice_id).filter(Boolean));
  const icBillIds = new Set(icLinksRes.rows.map((r: { mirror_bill_id: string }) => r.mirror_bill_id).filter(Boolean));
  const icElimination = icLinksRes.rows.reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount || '0'), 0);

  // Revenue across all entities (excluding intercompany)
  let totalRevenue = 0;
  let totalCosts = 0;
  const entityBreakdown = [];

  for (const entity of entities) {
    const [revRes, costRes] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total), 0) as total FROM acc_invoices
         WHERE entity_id = $1 AND status = 'paid' AND due_date >= $2 AND due_date <= $3`,
        [entity.id, from, to]
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM acc_bills
         WHERE entity_id = $1 AND due_date >= $2 AND due_date <= $3`,
        [entity.id, from, to]
      ),
    ]);

    // Get intercompany revenue/costs for this entity to eliminate
    const icRevRes = await query(
      `SELECT COALESCE(SUM(total), 0) as total FROM acc_invoices
       WHERE entity_id = $1 AND id = ANY($2::uuid[]) AND due_date >= $3 AND due_date <= $4`,
      [entity.id, icInvoiceIds.size > 0 ? Array.from(icInvoiceIds) : ['00000000-0000-0000-0000-000000000000'], from, to]
    );
    const icBillRes = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM acc_bills
       WHERE entity_id = $1 AND id = ANY($2::uuid[]) AND due_date >= $3 AND due_date <= $4`,
      [entity.id, icBillIds.size > 0 ? Array.from(icBillIds) : ['00000000-0000-0000-0000-000000000000'], from, to]
    );

    const revenue = parseFloat(revRes.rows[0].total);
    const costs = parseFloat(costRes.rows[0].total);
    const icRev = parseFloat(icRevRes.rows[0].total);
    const icBill = parseFloat(icBillRes.rows[0].total);

    totalRevenue += revenue - icRev;
    totalCosts += costs - icBill;

    entityBreakdown.push({
      entityId: entity.id,
      entityName: entity.name,
      revenue: revenue - icRev,
      costs: costs - icBill,
      grossProfit: (revenue - icRev) - (costs - icBill),
      intercompanyEliminated: icRev + icBill,
    });
  }

  const grossProfit = totalRevenue - totalCosts;

  return {
    from,
    to,
    totalRevenue,
    totalCosts,
    grossProfit,
    netProfit: grossProfit,
    intercompanyElimination: icElimination,
    entityBreakdown,
  };
}

export async function getConsolidatedBalanceSheet(userId: string) {
  const entities = await query(`SELECT id, name FROM entities WHERE user_id = $1`, [userId]);

  let totalReceivables = 0;
  let totalPayables = 0;
  const entityBreakdown = [];

  for (const entity of entities.rows) {
    const [recRes, payRes] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total), 0) as total FROM acc_invoices
         WHERE entity_id = $1 AND status IN ('sent', 'overdue')`,
        [entity.id]
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM acc_bills
         WHERE entity_id = $1 AND status IN ('unpaid', 'overdue')`,
        [entity.id]
      ),
    ]);

    const receivables = parseFloat(recRes.rows[0].total);
    const payables = parseFloat(payRes.rows[0].total);

    totalReceivables += receivables;
    totalPayables += payables;

    entityBreakdown.push({
      entityId: entity.id,
      entityName: entity.name,
      receivables,
      payables,
      netPosition: receivables - payables,
    });
  }

  return {
    totalReceivables,
    totalPayables,
    netPosition: totalReceivables - totalPayables,
    entityBreakdown,
  };
}
