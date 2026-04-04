// lib/tiers.ts
// Single source of truth for tier definitions, pricing, and feature access
// The database stores the user's tier. This file defines what each tier means.

export type Tier = 'invoicing' | 'sole_trader' | 'small_business' | 'medium_business' | 'corporate' | 'accountant';

export type Feature =
  | 'invoicing'
  | 'card_payments'
  | 'quotes'
  | 'credit_notes'
  | 'disable_card_payments'
  | 'accountant_access'
  | 'enter_bills'
  | 'real_time_reports'
  | 'performance_graphs'
  | 'bank_reconciliation'
  | 'payment_reminders'
  | 'mtd_vat'
  | 'cis'
  | 'granular_permissions'
  | 'capture_bills_receipts'
  | 'expenses_mileage'
  | 'domestic_bill_payments'
  | 'ebanking'
  | 'mismatch_flagging'
  | 'custom_branding'
  | 'multi_currency'
  | 'po_approvals'
  | 'per_user_spend_limits'
  | 'kpi_analysis'
  | 'custom_dashboards'
  | 'international_payments'
  | 'multi_entity'
  | 'intercompany'
  | 'consolidated_dashboard'
  | 'multi_entity_reporting'
  | 'cashflow_forecast'
  | 'excel_import'
  | 'platform_migration'
  | 'audit_log'
  | 'payroll'
  | 'project_tracking'
  | 'opening_balances'
  | 'year_end_close';

// Maps each feature to the tiers that can access it
const FEATURE_ACCESS: Record<Feature, Tier[]> = {
  // All tiers
  invoicing:              ['invoicing', 'sole_trader', 'small_business', 'medium_business', 'corporate', 'accountant'],
  card_payments:          ['invoicing', 'sole_trader', 'small_business', 'medium_business', 'corporate', 'accountant'],
  quotes:                 ['invoicing', 'sole_trader', 'small_business', 'medium_business', 'corporate', 'accountant'],

  // Sole trader and above
  credit_notes:           ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  disable_card_payments:  ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  accountant_access:      ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  enter_bills:            ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  real_time_reports:      ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  performance_graphs:     ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  bank_reconciliation:    ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  payment_reminders:      ['sole_trader', 'small_business', 'medium_business', 'corporate'],

  // Small business and above
  mtd_vat:                ['small_business', 'medium_business', 'corporate'],
  cis:                    ['small_business', 'medium_business', 'corporate'],
  granular_permissions:   ['small_business', 'medium_business', 'corporate'],
  capture_bills_receipts: ['small_business', 'medium_business', 'corporate'],
  expenses_mileage:       ['small_business', 'medium_business', 'corporate'],
  domestic_bill_payments: ['small_business', 'medium_business', 'corporate'],
  ebanking:               ['small_business', 'medium_business', 'corporate'],
  mismatch_flagging:      ['small_business', 'medium_business', 'corporate'],

  // Medium business and above
  custom_branding:        ['medium_business', 'corporate'],
  multi_currency:         ['medium_business', 'corporate'],
  po_approvals:           ['medium_business', 'corporate'],
  per_user_spend_limits:  ['medium_business', 'corporate'],
  kpi_analysis:           ['medium_business', 'corporate'],
  custom_dashboards:      ['medium_business', 'corporate'],
  international_payments: ['medium_business', 'corporate'],

  // Corporate only
  multi_entity:           ['corporate'],
  intercompany:           ['corporate'],
  consolidated_dashboard: ['corporate'],
  multi_entity_reporting: ['corporate'],
  cashflow_forecast:      ['corporate'],
  excel_import:           ['small_business', 'medium_business', 'corporate'],
  platform_migration:     ['small_business', 'medium_business', 'corporate'],
  audit_log:              ['corporate'],

  // Add-ons
  payroll:                [],
  project_tracking:       ['small_business', 'medium_business', 'corporate'],
  opening_balances:       ['sole_trader', 'small_business', 'medium_business', 'corporate'],
  year_end_close:         ['sole_trader', 'small_business', 'medium_business', 'corporate'],
};

// Check if a tier can access a feature
export function canAccess(tier: Tier | null | undefined, feature: Feature): boolean {
  if (!tier) return false;
  return FEATURE_ACCESS[feature]?.includes(tier) ?? false;
}

// Tier display config
export const TIER_CONFIG: Record<Tier, {
  label: string;
  introPrice: string;
  normalPrice: string;
  description: string;
  highlight?: boolean;
}> = {
  invoicing: {
    label: 'Invoicing',
    introPrice: 'Free',
    normalPrice: 'Free forever',
    description: 'Send unlimited invoices and accept card payments',
  },
  sole_trader: {
    label: 'Sole Trader',
    introPrice: '£0.99/mo',
    normalPrice: '£4.99/mo',
    description: 'Everything in Invoicing plus expenses, reports, and bank reconciliation',
  },
  small_business: {
    label: 'Small Business',
    introPrice: '£1.99/mo',
    normalPrice: '£12.50/mo',
    description: 'Everything in Sole Trader plus MTD VAT, CIS, and bill payments',
    highlight: true,
  },
  medium_business: {
    label: 'Medium Business',
    introPrice: '£4.99/mo',
    normalPrice: '£29/mo',
    description: 'Everything in Small Business plus multi-currency, custom branding, and PO approvals',
  },
  corporate: {
    label: 'Corporate',
    introPrice: '£8.99/mo',
    normalPrice: '£49/mo',
    description: 'Everything plus multi-entity support. Includes 3 entities, +£20/entity, price capped at £289/mo',
  },
  accountant: {
    label: 'Accountant',
    introPrice: 'Free',
    normalPrice: 'Free forever',
    description: 'Access all your client accounts from one place',
  },
};

// Tier order for upgrade path
export const TIER_ORDER: Tier[] = [
  'invoicing',
  'sole_trader',
  'small_business',
  'medium_business',
  'corporate',
];

// Returns the minimum tier needed to access a feature
export function requiredTier(feature: Feature): Tier | null {
  for (const tier of TIER_ORDER) {
    if (FEATURE_ACCESS[feature]?.includes(tier)) return tier;
  }
  return null;
}

// Payment processing fee (shown to users — never mention Stripe)
export const PROCESSING_FEE = '2.5% + 20p';
export const PROCESSING_FEE_DETAIL = 'UK debit and credit cards. No setup fees, no monthly fees.';