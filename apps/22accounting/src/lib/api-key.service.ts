// src/lib/api-key.service.ts
import crypto from 'crypto';
import { query } from './db';

export type ApiKeyScope =
  | 'invoices:read'  | 'invoices:write'
  | 'customers:read' | 'customers:write'
  | 'suppliers:read' | 'suppliers:write'
  | 'bills:read'     | 'bills:write'
  | 'expenses:read'
  | 'reports:read'
  | 'webhooks:manage';

export const ALL_SCOPES: ApiKeyScope[] = [
  'invoices:read', 'invoices:write',
  'customers:read', 'customers:write',
  'suppliers:read', 'suppliers:write',
  'bills:read', 'bills:write',
  'expenses:read', 'reports:read', 'webhooks:manage',
];

export interface ApiKey {
  id: string;
  entity_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  is_test_mode: boolean;
  allowed_ips: string[] | null;
  last_used_at: string | null;
  rotated_at: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

/** Generate a new API key. Returns the raw key (shown once) plus the DB row. */
export async function generateApiKey(params: {
  entityId: string;
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  isTestMode?: boolean;
  allowedIps?: string[];
  expiresAt?: string;
}): Promise<{ rawKey: string; apiKey: ApiKey }> {
  const rawBytes = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const rawKey = `rly_${rawBytes}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawBytes.slice(0, 8); // first 8 chars of the hex portion

  const r = await query(
    `INSERT INTO acc_api_keys
       (entity_id, user_id, name, key_hash, key_prefix, scopes, is_test_mode, allowed_ips, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      params.entityId,
      params.userId,
      params.name,
      keyHash,
      keyPrefix,
      params.scopes,
      params.isTestMode ?? false,
      params.allowedIps ?? null,
      params.expiresAt ?? null,
    ]
  );
  return { rawKey, apiKey: r.rows[0] };
}

/** Validate an incoming raw API key. Returns the key row or null if invalid. */
export async function validateApiKey(rawKey: string, clientIp?: string): Promise<ApiKey | null> {
  if (!rawKey.startsWith('rly_')) return null;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const r = await query(
    `SELECT * FROM acc_api_keys WHERE key_hash = $1`,
    [keyHash]
  );
  if (r.rows.length === 0) return null;
  const key: ApiKey = r.rows[0];

  // Revoked
  if (key.revoked_at) return null;

  // Expired
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;

  // Rotated: 1-hour grace period
  if (key.rotated_at) {
    const graceCutoff = new Date(new Date(key.rotated_at).getTime() + 60 * 60 * 1000);
    if (new Date() > graceCutoff) return null;
  }

  // IP allowlist
  if (key.allowed_ips && key.allowed_ips.length > 0 && clientIp) {
    if (!key.allowed_ips.includes(clientIp)) return null;
  }

  // Update last_used_at asynchronously (fire-and-forget, non-blocking)
  query('UPDATE acc_api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]).catch(() => {});

  return key;
}

/** Rotate a key: generate new key, set rotated_at on old row. */
export async function rotateApiKey(keyId: string, entityId: string): Promise<{ rawKey: string; newKey: ApiKey } | null> {
  // Fetch old key to copy config
  const r = await query(
    'SELECT * FROM acc_api_keys WHERE id = $1 AND entity_id = $2 AND revoked_at IS NULL',
    [keyId, entityId]
  );
  if (r.rows.length === 0) return null;
  const old: ApiKey = r.rows[0];

  // Mark old key as rotated (starts 1-hour grace period)
  await query('UPDATE acc_api_keys SET rotated_at = NOW() WHERE id = $1', [keyId]);

  // Create new key with same config
  return generateApiKey({
    entityId: old.entity_id,
    userId: old.user_id,
    name: old.name,
    scopes: old.scopes,
    isTestMode: old.is_test_mode,
    allowedIps: old.allowed_ips ?? undefined,
    expiresAt: old.expires_at ?? undefined,
  }).then(result => ({ rawKey: result.rawKey, newKey: result.apiKey }));
}

/** Revoke a key immediately. */
export async function revokeApiKey(keyId: string, entityId: string): Promise<boolean> {
  const r = await query(
    'UPDATE acc_api_keys SET revoked_at = NOW() WHERE id = $1 AND entity_id = $2 AND revoked_at IS NULL RETURNING id',
    [keyId, entityId]
  );
  return r.rows.length > 0;
}

/** List all keys for an entity (never returns key_hash). */
export async function listApiKeys(entityId: string): Promise<ApiKey[]> {
  const r = await query(
    `SELECT id, entity_id, user_id, name, key_prefix, scopes, is_test_mode,
            allowed_ips, last_used_at, rotated_at, created_at, expires_at, revoked_at
     FROM acc_api_keys WHERE entity_id = $1 ORDER BY created_at DESC`,
    [entityId]
  );
  return r.rows;
}

/** Log an API request (async, fire-and-forget). */
export function logApiRequest(params: {
  keyId: string;
  entityId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
}): void {
  query(
    `INSERT INTO acc_api_requests (key_id, entity_id, endpoint, method, status_code, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.keyId, params.entityId, params.endpoint, params.method, params.statusCode, params.durationMs]
  ).catch(() => {}); // never throw — logging must not block responses
}
