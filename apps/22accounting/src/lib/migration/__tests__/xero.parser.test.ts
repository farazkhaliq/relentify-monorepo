import { XeroParser } from '../xero.parser';

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

const CUTOFF = '2024-12-31';

const COA_CSV = `AccountCode,Name,Type,TaxType,Description
1100,Trade Debtors,CURRENT,NONE,Debtors
4000,Sales,REVENUE,OUTPUT,Revenue`;

const CONTACTS_CSV = `ContactName,IsCustomer,IsSupplier,Email,Phone
Acme Ltd,TRUE,FALSE,acme@example.com,01234567890
Build Co,FALSE,TRUE,build@example.com,`;

const INVOICES_CSV = `InvoiceNumber,ContactName,InvoiceDate,DueDate,UnitAmount,TaxAmount,TaxRate,Status
INV-001,Acme Ltd,2024-11-01,2024-11-30,1000.00,200.00,20,AUTHORISED
INV-002,Acme Ltd,2025-01-15,2025-02-15,500.00,100.00,20,AUTHORISED`;

const TRIAL_BALANCE_CSV = `AccountCode,Name,Debit,Credit
1100,Trade Debtors,1200.00,0
4000,Sales,0,1200.00`;

describe('XeroParser', () => {
  it('parses accounts, customers, suppliers, invoices within cutoff', async () => {
    const parser = new XeroParser();
    const data = await parser.parse([
      makeFile('Chart of Accounts.csv', COA_CSV),
      makeFile('Contacts.csv', CONTACTS_CSV),
      makeFile('Invoices.csv', INVOICES_CSV),
      makeFile('Trial Balance.csv', TRIAL_BALANCE_CSV),
    ], CUTOFF);

    expect(data.accounts).toHaveLength(2);
    expect(data.customers).toHaveLength(1);
    expect(data.customers[0].name).toBe('Acme Ltd');
    expect(data.suppliers).toHaveLength(1);
    expect(data.suppliers[0].name).toBe('Build Co');

    // INV-002 is after cutoff — should be excluded
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0].sourceRef).toBe('INV-001');

    expect(data.trialBalance.totalDebits).toBeCloseTo(1200);
    expect(data.trialBalance.totalCredits).toBeCloseTo(1200);
  });

  it('handles missing optional files gracefully', async () => {
    const parser = new XeroParser();
    const data = await parser.parse([
      makeFile('Chart of Accounts.csv', COA_CSV),
      makeFile('Trial Balance.csv', TRIAL_BALANCE_CSV),
    ], CUTOFF);
    expect(data.invoices).toHaveLength(0);
    expect(data.bills).toHaveLength(0);
  });

  it('deduplicates contacts that appear as both customer and supplier', async () => {
    const csv = `ContactName,IsCustomer,IsSupplier,Email,Phone\nBoth Co,TRUE,TRUE,both@example.com,`;
    const parser = new XeroParser();
    const data = await parser.parse([
      makeFile('Chart of Accounts.csv', COA_CSV),
      makeFile('Contacts.csv', csv),
      makeFile('Trial Balance.csv', TRIAL_BALANCE_CSV),
    ], CUTOFF);
    expect(data.customers.find(c => c.name === 'Both Co')).toBeTruthy();
    expect(data.suppliers.find(s => s.name === 'Both Co')).toBeTruthy();
  });
});
