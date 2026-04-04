// src/lib/v1-helpers.ts
import { NextRequest, NextResponse } from 'next/server';
import type { ApiKeyScope } from './api-key.service';
import { validateApiKey, logApiRequest } from './api-key.service';
import { checkRateLimit } from './rate-limiter';

export interface ApiKeyContext {
  keyId: string;
  entityId: string;
  userId: string;
  scopes: ApiKeyScope[];
  isTestMode: boolean;
}

/**
 * Validate API key from Authorization header, check rate limits, and return context.
 * This runs in Node.js runtime (route handlers), not Edge (middleware).
 */
export async function requireApiKeyContext(req: NextRequest): Promise<{ ctx: ApiKeyContext } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!rawKey) {
    return NextResponse.json(
      { error: { code: 'missing_api_key', message: 'Authorization: Bearer <key> header required', status: 401 } },
      { status: 401 }
    );
  }

  const clientIp =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    undefined;

  const apiKey = await validateApiKey(rawKey, clientIp);
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'invalid_api_key', message: 'API key is invalid, expired, or revoked', status: 401 } },
      { status: 401 }
    );
  }

  // IP allowlist safety check
  if (apiKey.allowed_ips && apiKey.allowed_ips.length > 0 && !clientIp) {
    return NextResponse.json(
      { error: { code: 'ip_required', message: 'Cannot determine client IP for allowlist check', status: 403 } },
      { status: 403 }
    );
  }

  // Rate limiting
  const rl = checkRateLimit(apiKey.id, apiKey.is_test_mode ? 'corporate' : undefined);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limit_exceeded', message: 'Too many requests', status: 429 } },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetAt - Math.floor(Date.now() / 1000)),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetAt),
        },
      }
    );
  }

  // Log request (fire-and-forget)
  logApiRequest({
    keyId: apiKey.id,
    entityId: apiKey.entity_id,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    statusCode: 0,
    durationMs: 0,
  });

  return {
    ctx: {
      keyId: apiKey.id,
      entityId: apiKey.entity_id,
      userId: apiKey.user_id,
      scopes: apiKey.scopes,
      isTestMode: apiKey.is_test_mode,
    },
  };
}

/** Check that ctx.scopes includes the required scope. Returns 403 response if not. */
export function requireScope(ctx: ApiKeyContext, scope: ApiKeyScope): NextResponse | null {
  if (!ctx.scopes.includes(scope)) {
    return NextResponse.json(
      {
        error: {
          code: `${scope.replace(':', '_')}_denied`,
          message: `API key missing ${scope} scope`,
          status: 403,
        },
      },
      { status: 403 }
    );
  }
  return null;
}

/** Wrap data in the standard success envelope. */
export function apiSuccess<T>(
  data: T,
  opts?: { status?: number; pagination?: { page: number; limit: number; total: number; hasMore: boolean }; testMode?: boolean }
): NextResponse {
  const body: Record<string, unknown> = { data };
  if (opts?.pagination) body.pagination = opts.pagination;
  if (opts?.testMode) body.test = true;
  return NextResponse.json(body, { status: opts?.status ?? 200 });
}

/** Wrap an error in the standard error envelope. */
export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message, status } }, { status });
}

/** Parse common list query params: page, limit, from, to, status. */
export function parseListParams(req: NextRequest) {
  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const offset = (page - 1) * limit;
  return { page, limit, offset, from, to, status };
}
