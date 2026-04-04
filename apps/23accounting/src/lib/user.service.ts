import { query } from './db';
import { hashPassword } from './auth';

const USER_COLS = `id, email, full_name, business_name, user_type, stripe_account_id,
  stripe_account_status, business_structure, company_number, vat_registered, vat_number,
  is_active, subscription_plan as tier, subscription_status, trial_ends_at, created_at,
  stripe_customer_id, COALESCE(accept_card_payments, true) as accept_card_payments,
  COALESCE(payment_reminders_enabled, false) as payment_reminders_enabled,
  active_entity_id,
  referred_by_accountant_id, referral_started_at, referral_expires_at,
  accountant_bank_account_name, accountant_sort_code, accountant_account_number`;

export async function createUser(data: { email: string; password: string; fullName: string; businessName?: string; userType: string }) {
  const hash = await hashPassword(data.password);
  const r = await query(
    `INSERT INTO users (email, password_hash, full_name, business_name, user_type) VALUES ($1,$2,$3,$4,$5) RETURNING ${USER_COLS}`,
    [data.email, hash, data.fullName, data.businessName || null, data.userType]
  );
  return r.rows[0];
}

export async function getUserByEmail(email: string) {
  const r = await query(`SELECT ${USER_COLS}, password_hash FROM users WHERE email = $1`, [email]);
  return r.rows[0] || null;
}

export async function getUserById(id: string) {
  const r = await query(`SELECT ${USER_COLS}, password_hash FROM users WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

export async function updateUserStripeAccount(userId: string, accountId: string, status: string) {
  await query(`UPDATE users SET stripe_account_id=$1, stripe_account_status=$2 WHERE id=$3`, [accountId, status, userId]);
}

export async function clearUserStripeAccount(userId: string) {
  await query(`UPDATE users SET stripe_account_id=NULL, stripe_account_status='not_connected' WHERE id=$1`, [userId]);
}

export async function updateLastLogin(userId: string) {
  await query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [userId]);
}

export async function updateUserSubscription(
  userId: string,
  params: {
    tier?: string;
    status?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }
) {
  await query(
    `UPDATE users SET
      subscription_plan = COALESCE($2, subscription_plan),
      subscription_status = COALESCE($3, subscription_status),
      stripe_customer_id = COALESCE($4, stripe_customer_id),
      stripe_subscription_id = COALESCE($5, stripe_subscription_id)
     WHERE id = $1`,
    [userId, params.tier ?? null, params.status ?? null, params.stripeCustomerId ?? null, params.stripeSubscriptionId ?? null]
  );
}

export async function getUserByStripeCustomerId(customerId: string) {
  const r = await query(`SELECT ${USER_COLS} FROM users WHERE stripe_customer_id = $1`, [customerId]);
  return r.rows[0] || null;
}
