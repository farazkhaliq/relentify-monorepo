import { query } from './db';

const KNOWN_PLAN_PRICE_IDS = [
  process.env.STRIPE_PRICE_ID_INVOICING,
  process.env.STRIPE_PRICE_ID_SOLE_TRADER,
  process.env.STRIPE_PRICE_ID_SMALL_BUSINESS,
  process.env.STRIPE_PRICE_ID_MEDIUM_BUSINESS,
  process.env.STRIPE_PRICE_ID_CORPORATE,
].filter(Boolean);

export function isSubscriptionInvoice(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return KNOWN_PLAN_PRICE_IDS.includes(priceId);
}

export async function recordReferralEarning(params: {
  stripeInvoiceId: string;
  clientUserId: string;
  grossAmount: number; // pence
  currency: string;
}) {
  // Look up referral attribution for the client
  const r = await query(
    `SELECT referred_by_accountant_id, referral_expires_at
     FROM users WHERE id = $1`,
    [params.clientUserId]
  );
  const user = r.rows[0];
  if (!user?.referred_by_accountant_id) return null; // not a referred client

  // Check 36-month window (NULL means no expiry set yet — treat as valid)
  if (user.referral_expires_at && new Date(user.referral_expires_at) < new Date()) return null;

  const commission = Math.floor(params.grossAmount * parseFloat(process.env.REFERRAL_COMMISSION_PCT ?? '0.10'));

  // Insert with ON CONFLICT DO NOTHING for idempotency (webhook may retry)
  const result = await query(
    `INSERT INTO acc_accountant_referral_earnings
       (accountant_user_id, client_user_id, stripe_invoice_id, gross_amount, commission_amount, currency)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (stripe_invoice_id) DO NOTHING
     RETURNING *`,
    [user.referred_by_accountant_id, params.clientUserId,
     params.stripeInvoiceId, params.grossAmount, commission, params.currency]
  );
  return result.rows[0] ?? null;
}

export async function getEarningsForAccountant(accountantUserId: string) {
  const r = await query(
    `SELECT
       are.*,
       u.full_name as client_name, u.business_name as client_business,
       u.email as client_email
     FROM acc_accountant_referral_earnings are
     JOIN users u ON u.id = are.client_user_id
     WHERE are.accountant_user_id = $1
     ORDER BY are.created_at DESC`,
    [accountantUserId]
  );
  return r.rows;
}
