export const features = {
  multiEntity: process.env.FEATURE_MULTI_ENTITY === 'true',
  expenseTracking: process.env.FEATURE_EXPENSE_TRACKING === 'true',
  advancedReporting: process.env.FEATURE_ADVANCED_REPORTING === 'true',
  automatedReminders: process.env.FEATURE_AUTOMATED_REMINDERS === 'true',
  vatMtd: process.env.FEATURE_VAT_MTD === 'true',
  payroll: process.env.FEATURE_PAYROLL === 'true',
  bankFeeds: process.env.FEATURE_BANK_FEEDS === 'true',
};
export function isFeatureEnabled(f: keyof typeof features) { return features[f] ?? false; }
