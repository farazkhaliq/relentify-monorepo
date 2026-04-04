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
