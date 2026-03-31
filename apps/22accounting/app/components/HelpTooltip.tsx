'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@relentify/ui'
import { Info } from 'lucide-react'

/** One-sentence descriptions for form fields. Single source of truth for tooltips. */
const fieldDescriptions: Record<string, string> = {
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

interface HelpTooltipProps {
  /** Key matching an entry in fieldDescriptions (e.g. "dueDate", "vatRate") */
  field: string
}

export function HelpTooltip({ field }: HelpTooltipProps) {
  const text = fieldDescriptions[field]
  if (!text) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={0}
            aria-label={`Help: ${field}`}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
          >
            <Info size={11} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
