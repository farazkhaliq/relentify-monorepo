import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

// Paths that skip auth (but still get rate-limited)
const PUBLIC_PATHS = [
  '/api/health',
  '/api/webhooks',
  '/api/cron',
  '/api/stripe/callback',
  '/api/hmrc/callback',
]

function getPublicUrl(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'accounts.relentify.com'
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const WINDOW_MS = 60 * 1000
const BAN_MS = 66 * 60 * 1000

interface RateEntry {
  count: number
  windowStart: number
  bannedUntil: number
}

const rateMap = new Map<string, RateEntry>()

// Prune stale entries every 10 minutes to prevent unbounded growth
let lastPrune = Date.now()
function pruneRateMap() {
  const now = Date.now()
  if (now - lastPrune < 10 * 60 * 1000) return
  lastPrune = now
  for (const [ip, entry] of rateMap) {
    if (entry.bannedUntil < now && now - entry.windowStart > WINDOW_MS) rateMap.delete(ip)
  }
}

function getLimit(pathname: string): number {
  if (/\/api\/invoices\/[^/]+\/send/.test(pathname)) return 5
  if (pathname.startsWith('/api/attachments')) return 10
  return 60
}

function isAllowed(ip: string, pathname: string): boolean {
  pruneRateMap()
  const now = Date.now()
  const limit = getLimit(pathname)
  const entry = rateMap.get(ip) ?? { count: 0, windowStart: now, bannedUntil: 0 }

  if (entry.bannedUntil > now) return false

  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 1
    entry.windowStart = now
    entry.bannedUntil = 0
    rateMap.set(ip, entry)
    return true
  }

  entry.count++
  if (entry.count > limit) {
    entry.bannedUntil = now + BAN_MS
    rateMap.set(ip, entry)
    return false
  }

  rateMap.set(ip, entry)
  return true
}

// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rate limit all API routes
  if (pathname.startsWith('/api/')) {
    const ip =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1'
    if (!isAllowed(ip, pathname)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(getPublicUrl(req))))

  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')

  if (!payload) {
    return NextResponse.redirect(new URL(getRedirectUrl(getPublicUrl(req))))
  }

  const isAccountant = payload.userType === 'accountant'
  const hasClientToken = !!req.cookies.get('relentify_client_token')?.value

  // Accountant with no active client → must stay in accountant portal
  if (isAccountant && !hasClientToken && pathname.startsWith('/dashboard/') && !pathname.startsWith('/dashboard/accountant')) {
    return NextResponse.redirect(new URL('/dashboard/accountant', getPublicUrl(req)))
  }

  // Non-accountant trying to access accountant portal → redirect to main dashboard
  if (!isAccountant && pathname.startsWith('/dashboard/accountant')) {
    return NextResponse.redirect(new URL('/dashboard', getPublicUrl(req)))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
