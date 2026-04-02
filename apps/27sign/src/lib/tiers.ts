export type Tier = 'free' | 'personal' | 'standard' | 'business_pro'

export type Feature =
  | 'create_requests'
  | 'saved_signatures'
  | 'api_keys'
  | 'webhook_callbacks'
  | 'certificate_of_completion'
  | 'rfc3161_timestamps'
  | 'custom_branding'
  | 'bulk_send'

const FEATURE_ACCESS: Record<Feature, Tier[]> = {
  create_requests:          ['free', 'personal', 'standard', 'business_pro'],
  saved_signatures:         ['free', 'personal', 'standard', 'business_pro'],
  api_keys:                 ['personal', 'standard', 'business_pro'],
  webhook_callbacks:        ['standard', 'business_pro'],
  certificate_of_completion: ['personal', 'standard', 'business_pro'],
  rfc3161_timestamps:       ['standard', 'business_pro'],
  custom_branding:          ['business_pro'],
  bulk_send:                ['business_pro'],
}

export const TIER_LIMITS: Record<Tier, { requestsPerMonth: number; apiKeys: number }> = {
  free:         { requestsPerMonth: 5,        apiKeys: 0 },
  personal:     { requestsPerMonth: 50,       apiKeys: 2 },
  standard:     { requestsPerMonth: 500,      apiKeys: 5 },
  business_pro: { requestsPerMonth: Infinity, apiKeys: 20 },
}

export function canAccess(tier: Tier | null | undefined, feature: Feature): boolean {
  if (!tier) return FEATURE_ACCESS[feature]?.includes('free') ?? false
  return FEATURE_ACCESS[feature]?.includes(tier) ?? false
}

export function getRequestLimit(tier: Tier | null | undefined): number {
  return TIER_LIMITS[tier || 'free'].requestsPerMonth
}

export function getApiKeyLimit(tier: Tier | null | undefined): number {
  return TIER_LIMITS[tier || 'free'].apiKeys
}
