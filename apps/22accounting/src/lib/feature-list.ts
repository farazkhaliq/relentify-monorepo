// lib/feature-list.ts
// Defines the features shown in the comparison table on the upgrade page.
// Driven by tiers.ts — this file controls display grouping and labels only.

import { type Feature } from './tiers';

export type FeatureRow = {
  label: string;
  feature: Feature;
  soon?: boolean;  // coming soon (v0.6) — shows "Soon" badge in all columns
  addon?: boolean; // available as a paid add-on, not included in base tier
};

export type FeatureCategory = {
  category: string;
  rows: FeatureRow[];
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    category: 'Sales Invoicing',
    rows: [
      { label: 'Unlimited invoices',                feature: 'invoicing' },
      { label: 'Quotes',                            feature: 'quotes' },
      { label: 'QR code for instant payment',       feature: 'invoicing' },
      { label: 'Accept online invoice payments',    feature: 'card_payments' },
      { label: 'Credit notes',                      feature: 'credit_notes' },
      { label: 'Payment reminders for unpaid invoices', feature: 'payment_reminders' },
      { label: 'Custom invoice & quote branding',   feature: 'custom_branding' },
    ],
  },
  {
    category: 'Expenses',
    rows: [
      { label: 'Supplier bills',                         feature: 'enter_bills' },
      { label: 'Receipt capture',                       feature: 'capture_bills_receipts' },
      { label: 'Expense claims & mileage',              feature: 'expenses_mileage' },
      { label: 'Automatic mismatch flagging',           feature: 'mismatch_flagging' },
      { label: 'Purchase order approvals',              feature: 'po_approvals' },
      { label: 'Configurable approval thresholds',      feature: 'po_approvals' },
      { label: 'Approval-first bills workflow',         feature: 'po_approvals' },
      { label: 'Email click-to-approve',                feature: 'po_approvals' },
      { label: 'PO → invoice → payment linkage',        feature: 'po_approvals' },
    ],
  },
  {
    category: 'Banking',
    rows: [
      { label: 'Bank accounts',          feature: 'bank_reconciliation' },
      { label: 'Multiple currencies',   feature: 'multi_currency' },
      { label: 'Cash flow forecasting', feature: 'cashflow_forecast' },
    ],
  },
  {
    category: 'Reporting',
    rows: [
      { label: 'Real-time reports',          feature: 'real_time_reports' },
      { label: 'Performance graphs',         feature: 'performance_graphs' },
      { label: 'KPI analysis & ratios',      feature: 'kpi_analysis' },
      { label: 'Customisable dashboards',    feature: 'custom_dashboards' },
    ],
  },
  {
    category: 'HMRC',
    rows: [
      { label: 'MTD ready — submit VAT returns to HMRC', feature: 'mtd_vat' },
    ],
  },
  {
    category: 'Admin',
    rows: [
      { label: 'Accountant access',            feature: 'accountant_access' },
      { label: 'Granular role-based permissions', feature: 'granular_permissions' },
      { label: 'Import Excel data',            feature: 'excel_import' },
      { label: 'Audit log',                    feature: 'audit_log' },
    ],
  },
  {
    category: 'Multi-Entity',
    rows: [
      { label: 'Native multi-entity support', feature: 'multi_entity' },
      { label: 'Intercompany transactions',   feature: 'intercompany' },
      { label: 'Consolidated dashboard',      feature: 'consolidated_dashboard' },
      { label: 'Multi-entity reporting',      feature: 'multi_entity_reporting' },
    ],
  },
  {
    category: 'Add-ons',
    rows: [
      { label: 'Project tracking', feature: 'project_tracking', addon: true },
    ],
  },
];
