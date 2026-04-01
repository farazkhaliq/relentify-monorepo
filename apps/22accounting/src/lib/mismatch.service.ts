import { query } from './db';

interface MismatchInput {
  userId: string;
  entityId: string;
  type: string;
  sourceType: string;
  sourceId: string;
  referenceType: string;
  referenceId: string;
  sourceAmount: number;
  referenceAmount: number;
  message: string;
}

function createMismatch(input: MismatchInput) {
  const diff = Math.abs(input.sourceAmount - input.referenceAmount);
  return query(
    `INSERT INTO mismatches (user_id, entity_id, type, source_type, source_id, reference_type, reference_id, source_amount, reference_amount, difference, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [input.userId, input.entityId, input.type, input.sourceType, input.sourceId,
     input.referenceType, input.referenceId, input.sourceAmount, input.referenceAmount,
     diff, input.message]
  );
}

/** Detect PO-to-bill amount mismatch. Threshold: diff > £1 AND > 2%. */
export async function detectBillPOMismatch(
  userId: string, entityId: string, billId: string, billAmount: number, poId: string
) {
  const poResult = await query('SELECT total FROM purchase_orders WHERE id = $1', [poId]);
  if (!poResult.rows[0]) return null;
  const poAmount = Number(poResult.rows[0].total);
  const diff = Math.abs(billAmount - poAmount);
  const pctDiff = poAmount > 0 ? (diff / poAmount) * 100 : 0;
  if (diff <= 1 || pctDiff <= 2) return null;
  return createMismatch({
    userId, entityId,
    type: 'po_bill_amount',
    sourceType: 'bill', sourceId: billId,
    referenceType: 'purchase_order', referenceId: poId,
    sourceAmount: billAmount, referenceAmount: poAmount,
    message: `Bill total (£${billAmount.toFixed(2)}) differs from PO total (£${poAmount.toFixed(2)}) by £${diff.toFixed(2)} (${pctDiff.toFixed(1)}%)`,
  });
}

/** Detect bank transaction match amount mismatch. */
export async function detectBankMismatch(
  userId: string, entityId: string, txId: string, txAmount: number,
  matchType: 'invoice' | 'bill', matchId: string, matchAmount: number
) {
  const diff = Math.abs(txAmount - matchAmount);
  if (diff < 0.01) return null;
  return createMismatch({
    userId, entityId,
    type: `bank_${matchType}_amount`,
    sourceType: 'bank_transaction', sourceId: txId,
    referenceType: matchType, referenceId: matchId,
    sourceAmount: txAmount, referenceAmount: matchAmount,
    message: `Bank transaction (£${txAmount.toFixed(2)}) differs from ${matchType} amount (£${matchAmount.toFixed(2)}) by £${diff.toFixed(2)}`,
  });
}

/** List mismatches for an entity, optionally filtered by status. */
export async function getMismatches(userId: string, entityId: string, status?: string) {
  const sql = status
    ? 'SELECT * FROM mismatches WHERE user_id = $1 AND entity_id = $2 AND status = $3 ORDER BY created_at DESC'
    : 'SELECT * FROM mismatches WHERE user_id = $1 AND entity_id = $2 ORDER BY created_at DESC';
  const params = status ? [userId, entityId, status] : [userId, entityId];
  return (await query(sql, params)).rows;
}

/** Resolve or ignore a mismatch. */
export async function resolveMismatch(id: string, userId: string, action: 'resolved' | 'ignored') {
  return (await query(
    `UPDATE mismatches SET status = $1, resolved_at = now(), resolved_by = $2 WHERE id = $3 RETURNING *`,
    [action, userId, id]
  )).rows[0];
}

/** Count open mismatches for an entity. */
export async function getMismatchCount(userId: string, entityId: string) {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM mismatches WHERE user_id = $1 AND entity_id = $2 AND status = $3',
    [userId, entityId, 'open']
  );
  return result.rows[0]?.count ?? 0;
}
