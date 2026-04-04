export type ConnectPlan = 'starter' | 'essentials' | 'growth' | 'professional' | 'enterprise'

export function canAccess(plan: string, feature: string): boolean {
  const gates: Record<string, ConnectPlan[]> = {
    'live_chat': ['essentials', 'growth', 'professional', 'enterprise'],
    'whatsapp': ['growth', 'professional', 'enterprise'],
    'voice': ['growth', 'professional', 'enterprise'],
    'sms': ['professional', 'enterprise'],
    'sla': ['growth', 'professional', 'enterprise'],
    'bots_unlimited': ['professional', 'enterprise'],
    'workflows': ['professional', 'enterprise'],
    'custom_reports': ['professional', 'enterprise'],
    'copilot': ['professional', 'enterprise'],
    'custom_roles': ['enterprise'],
    'audit_log': ['enterprise'],
    'sandbox': ['enterprise'],
    'sso': ['enterprise'],
    'qa_ai': ['enterprise'],
  }
  return (gates[feature] || []).includes(plan as ConnectPlan)
}

export const PLAN_DISPLAY: Record<ConnectPlan, { name: string; price: string; features: string[] }> = {
  starter: { name: 'Starter', price: '£12/seat/mo', features: ['Email support', '1 bot', '100 AI resolutions'] },
  essentials: { name: 'Essentials', price: '£20/seat/mo', features: ['Live chat', 'Email', '3 bots', '500 AI resolutions'] },
  growth: { name: 'Growth', price: '£39/seat/mo', features: ['WhatsApp', 'Voice', 'SLA', '10 bots', '2000 AI resolutions'] },
  professional: { name: 'Professional', price: '£75/seat/mo', features: ['SMS', 'Workflows', 'Custom reports', 'Unlimited bots', 'Copilot'] },
  enterprise: { name: 'Enterprise', price: '£119/seat/mo', features: ['SSO', 'Custom roles', 'Audit log', 'AI QA', 'Sandbox', 'Dedicated support'] },
}
