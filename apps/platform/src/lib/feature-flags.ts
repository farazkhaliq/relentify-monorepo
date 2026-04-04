import type { Product } from './product-context'

/**
 * Features available per product tier.
 * CRM ⊃ Connect ⊃ Chat
 */
const CHAT_FEATURES = [
  'inbox', 'tickets', 'knowledge', 'analytics', 'settings', 'visitors',
  'widget', 'triggers', 'sla', 'quality', 'portal',
]

const CONNECT_FEATURES = [
  ...CHAT_FEATURES,
  'channels', 'bots', 'workflows', 'voice', 'templates',
  'whatsapp', 'email_channel', 'sms', 'facebook', 'instagram',
  'qa_ai', 'connect_billing',
]

const REMINDERS_FEATURES = [
  'reminders_tasks', 'reminders_momentum', 'reminders_activity',
  'reminders_settings', 'reminders_workspaces', 'reminders_gamification',
]

const CRM_FEATURES = [
  ...CONNECT_FEATURES,
  ...REMINDERS_FEATURES,
  'contacts', 'properties', 'tenancies', 'maintenance',
  'documents', 'transactions', 'tasks', 'reports', 'audit_log',
  'dashboard', 'communications_archive', 'crm_portal',
]

const PRODUCT_FEATURES: Record<Product, string[]> = {
  chat: CHAT_FEATURES,
  connect: CONNECT_FEATURES,
  crm: CRM_FEATURES,
  reminders: REMINDERS_FEATURES,
}

export function canAccess(product: Product, feature: string): boolean {
  return PRODUCT_FEATURES[product]?.includes(feature) ?? false
}

export function getFeatures(product: Product): string[] {
  return PRODUCT_FEATURES[product] || []
}
