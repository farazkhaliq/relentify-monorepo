import { levenshtein, matchAccount, buildAccountMappings } from '../matcher';
import type { NormalisedAccount } from '../types';

const relentifyAccounts = [
  { code: 1100, name: 'Accounts Receivable (Debtors Control)', type: 'ASSET' },
  { code: 4000, name: 'Sales Revenue', type: 'INCOME' },
  { code: 7400, name: 'Office Supplies', type: 'EXPENSE' },
  { code: 7700, name: 'Bank Charges', type: 'EXPENSE' },
];

describe('levenshtein()', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });
  it('returns correct distance for small edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('sales', 'Sales')).toBe(1);
  });
});

describe('matchAccount()', () => {
  it('returns high confidence on exact name match', () => {
    const result = matchAccount('Sales Revenue', relentifyAccounts);
    expect(result.confidence).toBe('high');
    expect(result.targetCode).toBe(4000);
  });

  it('returns high confidence on exact code match', () => {
    const result = matchAccount('Any Name', relentifyAccounts, '1100');
    expect(result.confidence).toBe('high');
    expect(result.targetCode).toBe(1100);
  });

  it('returns medium confidence on fuzzy name match within distance 2', () => {
    // 'Bank Charge' vs 'Bank Charges' — Levenshtein distance 1 (missing 's')
    const result = matchAccount('Bank Charge', relentifyAccounts);
    expect(result.confidence).toBe('medium');
    expect(result.targetCode).toBe(7700);
  });

  it('returns none for unresolvable account', () => {
    const result = matchAccount('Totally Unknown Account XYZ', relentifyAccounts);
    expect(result.confidence).toBe('none');
    expect(result.targetCode).toBeNull();
  });

  it('returns medium on type-range match when name fails', () => {
    const result = matchAccount('Revenue from Consulting', relentifyAccounts, undefined, 'INCOME');
    expect(result.confidence).toBe('medium');
    expect(result.targetCode).toBe(4000);
  });
});

describe('buildAccountMappings()', () => {
  it('maps a list of source accounts using priority order', () => {
    const sourceAccounts: NormalisedAccount[] = [
      { sourceCode: '200', sourceName: 'Sales Revenue', sourceType: 'INCOME' },
      { sourceCode: '999', sourceName: 'Totally Unknown', sourceType: 'PAYROLL' },
    ];
    const mappings = buildAccountMappings(sourceAccounts, relentifyAccounts);
    expect(mappings).toHaveLength(2);
    expect(mappings[0].confidence).toBe('high');
    expect(mappings[1].confidence).toBe('none');
  });
});
