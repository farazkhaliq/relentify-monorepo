import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

type Product = 'chat' | 'connect' | 'crm'

const HOST_MAP: Record<string, Product> = {
  'chat.relentify.com': 'chat',
  'connect.relentify.com': 'connect',
  'crm.relentify.com': 'crm',
}

// Routes that never need auth
const PUBLIC_PATHS = ['/_next', '/api/health', '/api/widget', '/api/webhooks', '/widget.js', '/portal']
// Routes that handle their own auth (API key, cron secret, etc.)
const API_PATHS = ['/api']

// Routes only available to specific products
const PRODUCT_ROUTES: Record<string, Product[]> = {
  '/channels': ['connect', 'crm'],
  '/bots': ['connect', 'crm'],
  '/workflows': ['connect', 'crm'],
  '/templates': ['connect', 'crm'],
  '/contacts': ['crm'],
  '/properties': ['crm'],
  '/tenancies': ['crm'],
  '/maintenance': ['crm'],
  '/documents': ['crm'],
  '/transactions': ['crm'],
  '/tasks': ['crm'],
  '/reports': ['crm'],
  '/audit-log': ['crm'],
  '/dashboard': ['crm'],
  '/communications': ['crm'],
}

function getProduct(host: string): Product {
  for (const [domain, product] of Object.entries(HOST_MAP)) {
    if (host.includes(domain)) return product
  }
  return 'crm' // default (dev)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const product = getProduct(host)

  // Set product header for downstream use
  const response = NextResponse.next()
  response.headers.set('x-product', product)

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname.includes('.')) {
    response.headers.set('x-product', product)
    return response
  }

  // API routes handle their own auth
  if (pathname.startsWith('/api')) {
    response.headers.set('x-product', product)
    return response
  }

  // Check product-level route access
  for (const [route, allowedProducts] of Object.entries(PRODUCT_ROUTES)) {
    if (pathname.startsWith(route) && !allowedProducts.includes(product)) {
      // Product doesn't have access to this route — redirect to inbox
      return NextResponse.redirect(new URL('/inbox', req.url))
    }
  }

  // Auth check for app routes
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  const publicUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${host}${pathname}${req.nextUrl.search}`

  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')
  if (!payload) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
