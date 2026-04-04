const hits = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 60

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now > entry.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return true }
  entry.count++
  return entry.count <= MAX_REQUESTS
}

setInterval(() => { const now = Date.now(); for (const [k, v] of hits) { if (now > v.resetAt) hits.delete(k) } }, 5 * 60_000)
