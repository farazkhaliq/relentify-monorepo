// src/lib/migration/matcher.ts
import type { NormalisedAccount, AccountMapping, ConfidenceLevel } from './types';

const QB_TYPE_TO_RELENTIFY_TYPE: Record<string, string> = {
  'Bank':                    'ASSET',
  'Accounts Receivable':     'ASSET',
  'Other Current Asset':     'ASSET',
  'Accounts Payable':        'LIABILITY',
  'Credit Card':             'LIABILITY',
  'Income':                  'INCOME',
  'Cost of Goods Sold':      'COGS',
  'Expense':                 'EXPENSE',
  'BANK':                    'ASSET',
  'CURRENT':                 'ASSET',
  'CURRLIAB':                'LIABILITY',
  'REVENUE':                 'INCOME',
  'DIRECTCOSTS':             'COGS',
  'OVERHEADS':               'EXPENSE',
};

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

interface RelentifyAccount {
  code: number;
  name: string;
  type: string;
}

export function matchAccount(
  sourceName: string,
  relentifyAccounts: RelentifyAccount[],
  sourceCode?: string,
  sourceType?: string,
): { targetCode: number | null; confidence: ConfidenceLevel } {

  // Priority 1: exact name match (case-insensitive)
  const exactName = relentifyAccounts.find(
    a => a.name.toLowerCase() === sourceName.toLowerCase()
  );
  if (exactName) return { targetCode: exactName.code, confidence: 'high' };

  // Priority 2: account code match
  if (sourceCode) {
    const codeNum = parseInt(sourceCode, 10);
    const exactCode = relentifyAccounts.find(a => a.code === codeNum);
    if (exactCode) return { targetCode: exactCode.code, confidence: 'high' };
  }

  // Priority 3: fuzzy name match (Levenshtein distance ≤ 2)
  let bestDist = Infinity;
  let bestAccount: RelentifyAccount | null = null;
  for (const acct of relentifyAccounts) {
    const dist = levenshtein(sourceName.toLowerCase(), acct.name.toLowerCase());
    if (dist < bestDist) { bestDist = dist; bestAccount = acct; }
  }
  if (bestAccount && bestDist <= 2) {
    return { targetCode: bestAccount.code, confidence: 'medium' };
  }

  // Priority 4: type range match
  if (sourceType) {
    const mappedType = QB_TYPE_TO_RELENTIFY_TYPE[sourceType] ?? sourceType;
    const typeMatch = relentifyAccounts.find(a => a.type === mappedType);
    if (typeMatch) return { targetCode: typeMatch.code, confidence: 'medium' };
  }

  return { targetCode: null, confidence: 'none' };
}

export function buildAccountMappings(
  sourceAccounts: NormalisedAccount[],
  relentifyAccounts: RelentifyAccount[],
): AccountMapping[] {
  return sourceAccounts.map(src => {
    const { targetCode, confidence } = matchAccount(
      src.sourceName,
      relentifyAccounts,
      src.sourceCode,
      src.sourceType,
    );
    return {
      sourceCode: src.sourceCode,
      sourceName: src.sourceName,
      targetCode,
      confidence,
    };
  });
}
