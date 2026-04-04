import { headers, cookies } from 'next/headers'

export type Product = 'chat' | 'connect' | 'crm' | 'reminders'

const HOST_TO_PRODUCT: Record<string, Product> = {
  'chat.relentify.com': 'chat',
  'connect.relentify.com': 'connect',
  'crm.relentify.com': 'crm',
  'reminders.relentify.com': 'reminders',
  // Dev fallbacks
  'localhost:3040': 'crm',
}

/**
 * Server-side: read product from x-product header (set by middleware) or hostname.
 */
export async function getProduct(): Promise<Product> {
  const h = await headers()
  const explicit = h.get('x-product')
  if (explicit && ['chat', 'connect', 'crm', 'reminders'].includes(explicit)) return explicit as Product

  const host = h.get('x-forwarded-host') || h.get('host') || ''
  for (const [domain, product] of Object.entries(HOST_TO_PRODUCT)) {
    if (host.includes(domain)) return product
  }

  return 'crm' // Default to full access
}

/**
 * Product display names.
 */
export const PRODUCT_NAMES: Record<Product, string> = {
  chat: 'Relentify Chat',
  connect: 'Relentify Connect',
  crm: 'Relentify CRM',
  reminders: 'Relentify Reminders',
}

/**
 * Product URLs.
 */
export const PRODUCT_URLS: Record<Product, string> = {
  chat: 'https://chat.relentify.com',
  connect: 'https://connect.relentify.com',
  crm: 'https://crm.relentify.com',
  reminders: 'https://reminders.relentify.com',
}
