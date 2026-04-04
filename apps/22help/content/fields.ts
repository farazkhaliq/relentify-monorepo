/** Maps field keys to one-sentence tooltip descriptions.
 *  Consumed by apps/22accounting/app/components/HelpTooltip.tsx */
export const fieldDescriptions: Record<string, string> = {
  dueDate: 'The date by which your customer must pay.',
  invoiceDate: 'The date the invoice was issued — this is the tax point for VAT.',
  billDate: "The date shown on your supplier's invoice.",
  vatRate: 'The VAT rate applied to this line item. Use 20% for standard-rated goods.',
  accountCode: 'The chart of accounts category this transaction belongs to.',
  grossAmount: 'The total amount including VAT.',
  netAmount: 'The amount before VAT is applied.',
  validUntil: 'The date after which this quote is no longer valid.',
  paymentReference: 'A reference your customer should quote when making payment.',
  fromLocation: 'The starting point of the journey for mileage reimbursement.',
  toLocation: 'The destination of the journey for mileage reimbursement.',
  miles: 'The total distance in miles for this journey.',
  rate: 'The per-mile reimbursement rate in pence (HMRC advisory rate is 45p/mile).',
  openingBalance: 'The account balance at the start of your accounting period.',
  journalMemo: 'A note explaining why this journal entry was posted — required for audit trail.',
}
