export type ChatPlan = 'free' | 'branding' | 'ai' | 'branding_ai'

export type ChatFeature = 'remove_branding' | 'ai_replies'

const PLAN_FEATURES: Record<ChatPlan, ChatFeature[]> = {
  free: [],
  branding: ['remove_branding'],
  ai: ['ai_replies'],
  branding_ai: ['remove_branding', 'ai_replies'],
}

export function canAccess(plan: string, feature: ChatFeature): boolean {
  const features = PLAN_FEATURES[plan as ChatPlan]
  if (!features) return false
  return features.includes(feature)
}

export const PLAN_DISPLAY: Record<ChatPlan, { name: string; price: string }> = {
  free: { name: 'Free', price: '£0/mo' },
  branding: { name: 'Remove Branding', price: '£24.99/mo' },
  ai: { name: 'AI Auto-Reply', price: '£24.99/mo' },
  branding_ai: { name: 'Branding + AI', price: '£49.98/mo' },
}

export type ConnectPlan = 'starter' | 'essentials' | 'growth' | 'professional' | 'enterprise'

export const CONNECT_PLAN_DISPLAY: Record<ConnectPlan, { name: string; price: string; features: string[] }> = {
  starter: { name: 'Starter', price: '£12/seat/mo', features: ['Email support', '1 bot', '100 AI resolutions'] },
  essentials: { name: 'Essentials', price: '£20/seat/mo', features: ['Live chat', 'Email', '3 bots', '500 AI resolutions'] },
  growth: { name: 'Growth', price: '£39/seat/mo', features: ['WhatsApp', 'Voice', 'SLA', '10 bots', '2000 AI resolutions'] },
  professional: { name: 'Professional', price: '£75/seat/mo', features: ['SMS', 'Workflows', 'Custom reports', 'Unlimited bots', 'Copilot'] },
  enterprise: { name: 'Enterprise', price: '£119/seat/mo', features: ['SSO', 'Custom roles', 'Audit log', 'AI QA', 'Sandbox', 'Dedicated support'] },
}
