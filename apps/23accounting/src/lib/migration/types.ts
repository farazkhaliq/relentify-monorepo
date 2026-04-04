// src/lib/migration/types.ts

export type MigrationSourceId = 'xero' | 'quickbooks';

export type ConfidenceLevel = 'high' | 'medium' | 'none';

export interface MigrationSource {
  parse(files: File[], cutoffDate: string): Promise<MigrationData>;
}

export interface NormalisedAccount {
  sourceCode:  string;
  sourceName:  string;
  sourceType:  string;
  relentifyCode?: number;
  relentifyType?: string;
}

export interface NormalisedContact {
  name:    string;
  email?:  string;
  phone?:  string;
  address?: string;
}

export interface NormalisedInvoiceItem {
  description: string;
  quantity:    number;
  unitPrice:   number;
  taxRate:     number;
}

export interface NormalisedInvoice {
  sourceRef:    string;
  clientName:   string;
  clientEmail?: string;
  issueDate:    string;
  dueDate:      string;
  currency:     string;
  taxRate:      number;
  items:        NormalisedInvoiceItem[];
  status:       string;
}

export interface NormalisedBill {
  sourceRef:    string;
  supplierName: string;
  issueDate:    string;
  dueDate:      string;
  currency:     string;
  amount:       number;
  vatAmount:    number;
  vatRate:      number;
  accountCode?: number;
  category:     string;
}

export interface NormalisedBalance {
  accountCode: number;
  debit:       number;
  credit:      number;
}

export interface NormalisedTrialBalance {
  totalDebits:  number;
  totalCredits: number;
  lines:        NormalisedBalance[];
}

export interface MigrationData {
  accounts:        NormalisedAccount[];
  customers:       NormalisedContact[];
  suppliers:       NormalisedContact[];
  invoices:        NormalisedInvoice[];
  bills:           NormalisedBill[];
  openingBalances: NormalisedBalance[];
  trialBalance:    NormalisedTrialBalance;
  parseWarnings:   string[];
}

export interface AccountMapping {
  sourceCode:   string;
  sourceName:   string;
  targetCode:   number | null;
  confidence:   ConfidenceLevel;
}

export interface MigrationBatchResult {
  type:   'accounts' | 'customers' | 'suppliers' | 'invoices' | 'bills' | 'opening_balances';
  status: 'pending' | 'running' | 'completed' | 'failed';
  count:  number;
  error?: string;
}

export interface MigrationRunPayload {
  source:       MigrationSourceId;
  cutoffDate:   string;
  data:         MigrationData;
  mappings:     AccountMapping[];
  runId?:       string;
}
