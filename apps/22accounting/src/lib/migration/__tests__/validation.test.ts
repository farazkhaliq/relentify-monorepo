import { validateTrialBalance, classifyIssues } from '../validation';
import type { NormalisedTrialBalance } from '../types';

describe('validateTrialBalance()', () => {
  it('returns valid for balanced trial balance', () => {
    const tb: NormalisedTrialBalance = {
      totalDebits: 10000, totalCredits: 10000,
      lines: [
        { accountCode: 1200, debit: 10000, credit: 0 },
        { accountCode: 4000, debit: 0,     credit: 10000 },
      ],
    };
    const result = validateTrialBalance(tb);
    expect(result.valid).toBe(true);
    expect(result.discrepancy).toBe(0);
  });

  it('returns invalid for imbalanced trial balance exceeding £0.01', () => {
    const tb: NormalisedTrialBalance = {
      totalDebits: 10000.50, totalCredits: 10000,
      lines: [],
    };
    const result = validateTrialBalance(tb);
    expect(result.valid).toBe(false);
    expect(result.discrepancy).toBeCloseTo(0.50);
  });

  it('returns valid when imbalance is within £0.01 tolerance', () => {
    const tb: NormalisedTrialBalance = {
      totalDebits: 10000.005, totalCredits: 10000,
      lines: [],
    };
    const result = validateTrialBalance(tb);
    expect(result.valid).toBe(true);
  });
});

describe('classifyIssues()', () => {
  it('returns error for imbalanced trial balance', () => {
    const issues = classifyIssues({ trialBalanceValid: false, unmappedAccounts: 0, newCustomersToCreate: 0 });
    expect(issues.errors).toContain('Trial balance does not balance — import blocked until resolved');
    expect(issues.canProceed).toBe(false);
  });

  it('returns warning but can proceed for unmapped accounts with zero balance', () => {
    const issues = classifyIssues({ trialBalanceValid: true, unmappedAccounts: 2, newCustomersToCreate: 3 });
    expect(issues.warnings.length).toBeGreaterThan(0);
    expect(issues.canProceed).toBe(true);
  });
});
