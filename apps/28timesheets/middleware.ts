import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

const PUBLIC_PATHS = [
  '/api/health',
  '/api/cron/',
  '/api/v1/',
]

function getPublicUrl(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'timesheets.relentify.com'
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`
}

// Rate limiting
const WINDOW_MS = 60 * 1000
const BAN_MS = 66 * 60 * 1000

interface RateEntry {
  count: number
  windowStart: number
  bannedUntil: number
}

const rateMap = new Map<string, RateEntry>()

let lastPrune = Date.now()
function pruneRateMap() {
  const now = Date.now()
  if (now - lastPrune < 10 * 60 * 1000) return
  lastPrune = now
  for (const [ip, entry] of rateMap) {
    if (entry.bannedUntil < now && now - entry.windowStart > WINDOW_MS) rateMap.delete(ip)
  }
}

function isAllowed(ip: string): boolean {
  pruneRateMap()
  const now = Date.now()
  const limit = 60
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/')) {
    const ip =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1'
    if (!isAllowed(ip)) {
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

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/worker/:path*',
    '/feed/:path*',
    '/dashboard/:path*',
    '/schedule/:path*',
    '/approvals/:path*',
    '/sites/:path*',
    '/workers/:path*',
    '/settings/:path*',
    '/team/:path*',
    '/reports/:path*',
    '/overtime-rules/:path*',
    '/break-rules/:path*',
    '/audit/:path*',
    '/api/:path*',
  ],
}
