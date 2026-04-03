import { query } from './db';
import crypto from 'crypto';

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteClient(accountantUserId: string, inviteEmail: string) {
  const token = crypto.randomBytes(32).toString('hex');
  // Upsert: if pending invite exists for this accountant+email, refresh the token
  const r = await query(
    `INSERT INTO acc_accountant_clients (accountant_user_id, invite_email, invite_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (accountant_user_id, invite_email) WHERE status = 'pending'
     DO UPDATE SET invite_token = EXCLUDED.invite_token, invited_at = NOW()
     RETURNING *`,
    [accountantUserId, inviteEmail.toLowerCase().trim(), token]
  );
  return r.rows[0];
}

export async function getInviteByToken(token: string) {
  const r = await query(
    `SELECT ac.*, u.full_name as accountant_name, u.business_name as accountant_firm
     FROM acc_accountant_clients ac
     JOIN users u ON u.id = ac.accountant_user_id
     WHERE ac.invite_token = $1`,
    [token]
  );
  return r.rows[0] || null;
}

// ── Accept (existing client accepts accountant invite) ────────────────────────

export async function acceptInvite(token: string, clientUserId: string) {
  // Check if client already has an active accountant
  const existing = await query(
    `SELECT id FROM acc_accountant_clients WHERE client_user_id = $1 AND status = 'active'`,
    [clientUserId]
  );
  if (existing.rows.length > 0) throw new Error('CLIENT_HAS_ACCOUNTANT');

  const r = await query(
    `UPDATE acc_accountant_clients
     SET status = 'active', client_user_id = $1, accepted_at = NOW()
     WHERE invite_token = $2 AND status = 'pending'
     RETURNING *`,
    [clientUserId, token]
  );
  if (!r.rows[0]) throw new Error('INVALID_TOKEN');

  const invite = r.rows[0];

  // Set referral attribution (only if not already attributed)
  await query(
    `UPDATE users SET
       referred_by_accountant_id = COALESCE(referred_by_accountant_id, $1),
       referral_started_at       = COALESCE(referral_started_at, NOW()),
       referral_expires_at       = COALESCE(referral_expires_at, NOW() + INTERVAL '36 months')
     WHERE id = $2`,
    [invite.accountant_user_id, clientUserId]
  );

  return invite;
}

// ── Revoke access (either party) ──────────────────────────────────────────────

export async function revokeAccess(accountantUserId: string, clientUserId: string) {
  await query(
    `UPDATE acc_accountant_clients SET status = 'revoked', revoked_at = NOW()
     WHERE accountant_user_id = $1 AND client_user_id = $2 AND status = 'active'`,
    [accountantUserId, clientUserId]
  );
}

export async function revokeAccessByClient(clientUserId: string) {
  await query(
    `UPDATE acc_accountant_clients SET status = 'revoked', revoked_at = NOW()
     WHERE client_user_id = $1 AND status = 'active'`,
    [clientUserId]
  );
}

// ── List clients for accountant portal ───────────────────────────────────────

export async function getAccountantClients(accountantUserId: string) {
  const r = await query(
    `SELECT
       ac.id, ac.client_user_id, ac.invite_email, ac.status,
       ac.invited_at, ac.accepted_at,
       u.full_name, u.email, u.business_name, u.subscription_plan as tier,
       u.active_entity_id
     FROM acc_accountant_clients ac
     LEFT JOIN users u ON u.id = ac.client_user_id
     WHERE ac.accountant_user_id = $1 AND ac.status IN ('pending', 'active')
     ORDER BY ac.created_at DESC`,
    [accountantUserId]
  );
  return r.rows;
}

export async function getActiveClientForAccountant(accountantUserId: string, clientUserId: string) {
  const r = await query(
    `SELECT ac.* FROM acc_accountant_clients ac
     WHERE ac.accountant_user_id = $1 AND ac.client_user_id = $2 AND ac.status = 'active'`,
    [accountantUserId, clientUserId]
  );
  return r.rows[0] || null;
}

// ── Client health stats for accountant dashboard ──────────────────────────────

export async function getClientHealthStats(clientUserIds: string[]) {
  if (clientUserIds.length === 0) return {};

  const placeholders = clientUserIds.map((_, i) => `$${i + 1}`).join(', ');

  // Overdue invoices
  const overdueR = await query(
    `SELECT user_id, COUNT(*) as count
     FROM acc_invoices
     WHERE user_id IN (${placeholders}) AND status = 'overdue'
     GROUP BY user_id`,
    clientUserIds
  );

  // Unmatched bank transactions
  const unmatchedR = await query(
    `SELECT user_id, COUNT(*) as count
     FROM acc_bank_transactions
     WHERE user_id IN (${placeholders}) AND status = 'unmatched'
     GROUP BY user_id`,
    clientUserIds
  );

  // Bills without any attachment (missing receipts)
  const missingR = await query(
    `SELECT b.user_id, COUNT(*) as count
     FROM acc_bills b
     LEFT JOIN acc_attachments a ON a.record_type = 'bill' AND a.record_id = b.id::text
     WHERE b.user_id IN (${placeholders}) AND a.id IS NULL AND b.status != 'paid'
     GROUP BY b.user_id`,
    clientUserIds
  );

  // Build map keyed by user_id
  const stats: Record<string, { overdueInvoices: number; unmatchedTransactions: number; missingReceipts: number }> = {};
  for (const id of clientUserIds) {
    stats[id] = { overdueInvoices: 0, unmatchedTransactions: 0, missingReceipts: 0 };
  }
  for (const row of overdueR.rows)   stats[row.user_id].overdueInvoices       = parseInt(row.count);
  for (const row of unmatchedR.rows) stats[row.user_id].unmatchedTransactions = parseInt(row.count);
  for (const row of missingR.rows)   stats[row.user_id].missingReceipts       = parseInt(row.count);

  return stats;
}

// ── Settings: get accountant for a client (for client-side settings page) ────

export async function getClientAccountant(clientUserId: string) {
  const r = await query(
    `SELECT ac.id, ac.accountant_user_id, ac.status, ac.accepted_at,
            u.full_name as accountant_name, u.email as accountant_email, u.business_name as accountant_firm
     FROM acc_accountant_clients ac
     JOIN users u ON u.id = ac.accountant_user_id
     WHERE ac.client_user_id = $1 AND ac.status = 'active'`,
    [clientUserId]
  );
  return r.rows[0] || null;
}
