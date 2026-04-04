// src/lib/rate-limiter.ts

type SubscriptionPlan = 'invoicing' | 'sole_trader' | 'small_business' | 'medium_business' | 'corporate';

const LIMITS: Record<SubscriptionPlan | 'default', number> = {
  invoicing:        30,
  sole_trader:      60,
  small_business:  120,
  medium_business: 300,
  corporate:       600,
  default:          30,
};

const WINDOW_MS = 60_000; // 1 minute sliding window

// Map: key → array of timestamps (sliding window entries)
const windows = new Map<string, number[]>();

// Clean old entries periodically to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, ts] of windows.entries()) {
    const fresh = ts.filter(t => t > cutoff);
    if (fresh.length === 0) windows.delete(k);
    else windows.set(k, fresh);
  }
}, 30_000);

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix seconds
}

/**
 * Check and record a request against the sliding window.
 * bucketKey: typically the api_key id or entity_id.
 * plan: subscription plan, used to look up the per-minute limit.
 */
export function checkRateLimit(bucketKey: string, plan?: string): RateLimitResult {
  const limit = LIMITS[(plan as SubscriptionPlan) ?? 'default'] ?? LIMITS.default;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const ts = (windows.get(bucketKey) ?? []).filter(t => t > cutoff);
  const allowed = ts.length < limit;

  if (allowed) {
    ts.push(now);
    windows.set(bucketKey, ts);
  }

  // Reset = when the oldest request in the window expires
  const oldestInWindow = ts[0] ?? now;
  const resetAt = Math.ceil((oldestInWindow + WINDOW_MS) / 1000);

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - ts.length),
    resetAt,
  };
}
