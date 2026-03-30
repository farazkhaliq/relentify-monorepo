// src/lib/migration/validation.ts

export interface TrialBalanceValidationResult {
  valid:       boolean;
  discrepancy: number;
}

export function validateTrialBalance(tb: {
  totalDebits: number;
  totalCredits: number;
}): TrialBalanceValidationResult {
  const diff = Math.abs(tb.totalDebits - tb.totalCredits);
  return { valid: diff <= 0.01, discrepancy: diff };
}

export interface IssueClassification {
  errors:     string[];
  warnings:   string[];
  canProceed: boolean;
}

export function classifyIssues(checks: {
  trialBalanceValid:    boolean;
  unmappedAccounts:     number;
  newCustomersToCreate: number;
}): IssueClassification {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!checks.trialBalanceValid) {
    errors.push('Trial balance does not balance — import blocked until resolved');
  }
  if (checks.unmappedAccounts > 0) {
    warnings.push(`${checks.unmappedAccounts} account(s) could not be auto-mapped — please review`);
  }
  if (checks.newCustomersToCreate > 0) {
    warnings.push(`${checks.newCustomersToCreate} invoice(s) reference unknown customers — new customer records will be created`);
  }

  return { errors, warnings, canProceed: errors.length === 0 };
}
