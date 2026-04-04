import { query } from './db';

const BASE = process.env.HMRC_BASE_URL!;
const CLIENT_ID = process.env.HMRC_CLIENT_ID!;
const CLIENT_SECRET = process.env.HMRC_CLIENT_SECRET!;
const REDIRECT_URI = process.env.HMRC_REDIRECT_URI!;

export function getHmrcAuthUrl(state: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'read:vat write:vat',
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `${process.env.HMRC_AUTH_URL}?${params}`;
}

export async function exchangeHmrcCode(code: string) {
  const res = await fetch(`${BASE}/oauth/token`, {
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
  if (!res.ok) throw new Error(`HMRC token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function refreshHmrcToken(refreshToken: string) {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`HMRC token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function storeHmrcTokens(userId: string, tokens: { access_token: string; refresh_token: string; expires_in: number }) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await query(
    `UPDATE users SET hmrc_access_token=$1, hmrc_refresh_token=$2, hmrc_token_expires_at=$3 WHERE id=$4`,
    [tokens.access_token, tokens.refresh_token, expiresAt, userId]
  );
}

export async function clearHmrcTokens(userId: string) {
  await query(
    `UPDATE users SET hmrc_access_token=NULL, hmrc_refresh_token=NULL, hmrc_token_expires_at=NULL WHERE id=$1`,
    [userId]
  );
}

/** Returns a valid access token, refreshing if needed */
export async function getValidHmrcToken(userId: string): Promise<string> {
  const r = await query(
    `SELECT hmrc_access_token, hmrc_refresh_token, hmrc_token_expires_at FROM users WHERE id=$1`,
    [userId]
  );
  const row = r.rows[0];
  if (!row?.hmrc_access_token) throw new Error('HMRC not connected');

  const expiresAt = new Date(row.hmrc_token_expires_at);
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000; // refresh if < 5 min left

  if (!needsRefresh) return row.hmrc_access_token;

  const tokens = await refreshHmrcToken(row.hmrc_refresh_token);
  await storeHmrcTokens(userId, tokens);
  return tokens.access_token;
}

async function fraudHeaders(req: Request, userId: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  // Load stored browser data captured when user visited the VAT page
  const r = await query(
    `SELECT hmrc_device_id, hmrc_client_info FROM users WHERE id = $1`,
    [userId]
  );
  const row = r.rows[0] ?? {};
  const info = (row.hmrc_client_info as Record<string, string> | null) ?? {};

  return {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-Public-IP': ip,
    'Gov-Client-Public-IP-Timestamp': new Date().toISOString(),
    'Gov-Client-User-IDs': `relentify=${userId}`,
    // Stable UUID generated in the user's browser and persisted in localStorage
    'Gov-Client-Device-ID': row.hmrc_device_id ?? userId,
    'Gov-Client-Timezone': info.timezone ?? 'UTC+00:00',
    'Gov-Client-Screens': info.screens ?? 'width=1920&height=1080&scaling-factor=1&colour-depth=24',
    'Gov-Client-Window-Size': info.windowSize ?? 'width=1280&height=800',
    'Gov-Client-User-Agent': req.headers.get('user-agent') || 'Relentify/1.0',
    'Gov-Vendor-Version': 'Relentify=1.0.0',
  };
}

export async function getVatObligations(vrn: string, token: string, req: Request, userId: string) {
  // HMRC enforces max 366 days per query — fetch in yearly windows going back 3 years
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.hmrc.1.0+json',
    ...await fraudHeaders(req, userId),
  };

  const today = new Date();
  const allObligations: unknown[] = [];

  for (let i = 0; i < 3; i++) {
    const to = new Date(today);
    to.setFullYear(today.getFullYear() - i);
    const from = new Date(to);
    from.setFullYear(to.getFullYear() - 1);
    from.setDate(from.getDate() + 1); // avoid overlap

    const params = new URLSearchParams({
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    });

    const res = await fetch(`${BASE}/organisations/vat/${vrn}/obligations?${params}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      // 404 means no obligations in this window — skip
      if (res.status === 404) continue;
      throw new Error(`HMRC obligations error: ${text}`);
    }
    const data = await res.json() as { obligations?: unknown[] };
    if (data.obligations) allObligations.push(...data.obligations);
  }

  // Deduplicate by periodKey — multiple windows may return the same obligation
  const seen = new Set<string>();
  const unique = allObligations.filter((o) => {
    const key = (o as { periodKey: string }).periodKey;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { obligations: unique };
}

export async function calculateVatReturn(userId: string, from: string, to: string, entityId?: string) {
  // Box 1: VAT due on sales (output tax — standard VAT: all invoiced in period)
  const salesVat = await query(
    `SELECT COALESCE(SUM(tax_amount), 0) as vat, COALESCE(SUM(subtotal), 0) as net
     FROM acc_invoices
     WHERE entity_id=$1 AND status IN ('sent','paid','overdue') AND issue_date BETWEEN $2 AND $3`,
    [entityId || userId, from, to]
  );

  // Box 4: VAT reclaimed on purchases (input tax from bills — use invoice_date if present)
  const purchasesVat = await query(
    `SELECT COALESCE(SUM(vat_amount), 0) as vat, COALESCE(SUM(amount - vat_amount), 0) as net
     FROM acc_bills
     WHERE entity_id=$1 AND COALESCE(invoice_date, due_date) BETWEEN $2 AND $3`,
    [entityId || userId, from, to]
  );

  const box1 = parseFloat(salesVat.rows[0].vat);
  const box2 = 0;
  const box3 = parseFloat((box1 + box2).toFixed(2));
  const box4 = parseFloat(purchasesVat.rows[0].vat);
  const box5 = parseFloat(Math.abs(box3 - box4).toFixed(2));
  const box6 = Math.floor(parseFloat(salesVat.rows[0].net)); // whole pounds
  const box7 = Math.floor(parseFloat(purchasesVat.rows[0].net)); // whole pounds
  const box8 = 0;
  const box9 = 0;

  return { box1, box2, box3, box4, box5, box6, box7, box8, box9 };
}

export async function submitVatReturn(
  vrn: string,
  token: string,
  req: Request,
  userId: string,
  periodKey: string,
  boxes: ReturnType<typeof calculateVatReturn> extends Promise<infer T> ? T : never,
  finalised = true
) {
  const body = {
    periodKey,
    vatDueSales: boxes.box1,
    vatDueAcquisitions: boxes.box2,
    totalVatDue: boxes.box3,
    vatReclaimedCurrPeriod: boxes.box4,
    netVatDue: boxes.box5,
    totalValueSalesExVAT: boxes.box6,
    totalValuePurchasesExVAT: boxes.box7,
    totalValueGoodsSuppliedExVAT: boxes.box8,
    totalAcquisitionsExVAT: boxes.box9,
    finalised,
  };

  const res = await fetch(`${BASE}/organisations/vat/${vrn}/returns`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.hmrc.1.0+json',
      ...await fraudHeaders(req, userId),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HMRC submit error: ${await res.text()}`);
  return res.json();
}
