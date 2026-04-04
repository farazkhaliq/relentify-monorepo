import { QuickBooksParser } from '../quickbooks.parser';

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' });
}

const CUTOFF = '2024-12-31';

const IIF_CONTENT = `!ACCNT\tNAME\tACCNTTYPE\tDESC
ACCNT\tBank Account\tBank\tMain bank
!CUST\tNAME\tEMAIL
CUST\tAcme Ltd\tacme@example.com
!VEND\tNAME\tEMAIL
VEND\tBuild Co\tbuild@example.com
!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT
TRNS\tINVOICE\t2024-11-01\tAccounts Receivable\tAcme Ltd\t1200.00
!UNKNOWN_TYPE\tFOO
UNKNOWN_TYPE\tsome data
`;

describe('QuickBooksParser (IIF)', () => {
  it('parses accounts, customers, suppliers, transactions within cutoff', async () => {
    const parser = new QuickBooksParser();
    const data = await parser.parse([makeFile('company.iif', IIF_CONTENT)], CUTOFF);

    expect(data.accounts.length).toBeGreaterThanOrEqual(1);
    expect(data.customers[0].name).toBe('Acme Ltd');
    expect(data.suppliers[0].name).toBe('Build Co');
    expect(data.invoices).toHaveLength(1);
  });

  it('silently skips unknown row types and logs count to parseWarnings', async () => {
    const parser = new QuickBooksParser();
    const data = await parser.parse([makeFile('company.iif', IIF_CONTENT)], CUTOFF);
    expect(data.parseWarnings.some(w => w.includes('UNKNOWN_TYPE'))).toBe(true);
  });

  it('errors on missing required column gracefully (named validation error)', async () => {
    const badIif = `!TRNS\tTRNSTYPE\nTRNS\tINVOICE\n`;
    const parser = new QuickBooksParser();
    const data = await parser.parse([makeFile('bad.iif', badIif)], CUTOFF);
    expect(data.parseWarnings.length).toBeGreaterThan(0);
  });
});
