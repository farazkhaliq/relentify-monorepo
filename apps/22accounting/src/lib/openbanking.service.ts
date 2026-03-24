import { query } from './db';

const AUTH_URL = process.env.TRUELAYER_AUTH_URL!;
const API_URL = process.env.TRUELAYER_API_URL!;
const CLIENT_ID = process.env.TRUELAYER_CLIENT_ID!;
const CLIENT_SECRET = process.env.TRUELAYER_CLIENT_SECRET!;
const REDIRECT_URI = process.env.TRUELAYER_REDIRECT_URI!;

export function getTrueLayerAuthUrl(state: string) {
  // sandbox credentials need providers=sandbox; production uses uk-ob-all uk-oauth-all
  const providers = process.env.TRUELAYER_PROVIDERS
    || (CLIENT_ID.startsWith('sandbox-') ? 'sandbox' : 'uk-ob-all uk-oauth-all');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'info accounts balance offline_access',
    redirect_uri: REDIRECT_URI,
    state,
    providers,
  });
  return `${AUTH_URL}/?${params}`;
}

export async function exchangeTrueLayerCode(code: string) {
  const res = await fetch(`${AUTH_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) throw new Error(`TrueLayer token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function refreshTrueLayerToken(refreshToken: string) {
  const res = await fetch(`${AUTH_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`TrueLayer token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

async function getValidToken(connectionId: string): Promise<{ token: string; connection: Record<string, string> }> {
  const r = await query(`SELECT * FROM bank_connections WHERE id=$1`, [connectionId]);
  const conn = r.rows[0];
  if (!conn) throw new Error('Connection not found');

  const expiresAt = new Date(conn.token_expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const tokens = await refreshTrueLayerToken(conn.refresh_token);
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    await query(
      `UPDATE bank_connections SET access_token=$1, refresh_token=$2, token_expires_at=$3 WHERE id=$4`,
      [tokens.access_token, tokens.refresh_token, newExpiry, connectionId]
    );
    return { token: tokens.access_token, connection: conn };
  }
  return { token: conn.access_token, connection: conn };
}

export async function fetchAndStoreAccounts(userId: string, tokens: { access_token: string; refresh_token: string; expires_in: number }) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const res = await fetch(`${API_URL}/data/v1/accounts`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) throw new Error(`TrueLayer accounts fetch failed: ${await res.text()}`);
  const data = await res.json();
  const accounts: Array<{ account_id: string; display_name: string; account_type: string; currency: string }> = data.results || [];

  for (const acct of accounts) {
    // Check if already stored
    const existing = await query(
      `SELECT id FROM bank_connections WHERE user_id=$1 AND truelayer_account_id=$2`,
      [userId, acct.account_id]
    );
    if (existing.rows.length > 0) {
      await query(
        `UPDATE bank_connections SET access_token=$1, refresh_token=$2, token_expires_at=$3 WHERE id=$4`,
        [tokens.access_token, tokens.refresh_token, expiresAt, existing.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO bank_connections (user_id, access_token, refresh_token, token_expires_at, truelayer_account_id, display_name, account_type, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, tokens.access_token, tokens.refresh_token, expiresAt, acct.account_id, acct.display_name, acct.account_type, acct.currency]
      );
    }
  }
  return accounts.length;
}

export async function getConnections(userId: string) {
  const r = await query(
    `SELECT id, truelayer_account_id, display_name, account_type, currency, balance, balance_updated_at, created_at
     FROM bank_connections WHERE user_id=$1 ORDER BY created_at`,
    [userId]
  );
  return r.rows;
}

export async function syncTransactions(userId: string, connectionId: string) {
  const { token, connection } = await getValidToken(connectionId);
  const accountId = connection.truelayer_account_id;

  // Fetch balance
  const balRes = await fetch(`${API_URL}/data/v1/accounts/${accountId}/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (balRes.ok) {
    const balData = await balRes.json();
    const balance = balData.results?.[0]?.available ?? balData.results?.[0]?.current ?? null;
    await query(
      `UPDATE bank_connections SET balance=$1, balance_updated_at=NOW() WHERE id=$2`,
      [balance, connectionId]
    );
  }

  // Fetch last 90 days of transactions
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const txRes = await fetch(
    `${API_URL}/data/v1/accounts/${accountId}/transactions?from=${from.toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!txRes.ok) throw new Error(`TrueLayer transactions fetch failed: ${await txRes.text()}`);
  const txData = await txRes.json();
  const transactions: Array<{
    transaction_id: string;
    timestamp: string;
    description: string;
    amount: number;
    transaction_type: string;
    currency: string;
  }> = txData.results || [];

  let imported = 0;
  for (const tx of transactions) {
    const existing = await query(
      `SELECT id FROM bank_transactions WHERE user_id=$1 AND import_batch_id=$2`,
      [userId, tx.transaction_id]
    );
    if (existing.rows.length > 0) continue;

    const amount = Math.abs(tx.amount);
    const type = tx.amount >= 0 ? 'credit' : 'debit';
    const date = tx.timestamp.split('T')[0];

    await query(
      `INSERT INTO bank_transactions (user_id, transaction_date, description, amount, type, import_batch_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, date, tx.description, amount, type, tx.transaction_id]
    );
    imported++;
  }

  return { imported, total: transactions.length };
}

export async function disconnectAccount(userId: string, connectionId: string) {
  await query(`DELETE FROM bank_connections WHERE id=$1 AND user_id=$2`, [connectionId, userId]);
}
