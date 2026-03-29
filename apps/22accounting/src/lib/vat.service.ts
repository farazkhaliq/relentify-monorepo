// src/lib/vat.service.ts
// Explicit UK VAT rules — one named function per scenario.
// Services call these instead of duplicating calculation logic.

export interface VATResult {
  net: number
  vatAmount: number
  gross: number
  includesVATLine: boolean
  includeInBox6: boolean  // false only for exempt supplies
}

export interface ReverseChargeResult {
  net: number
  vatInput: number
  vatOutput: number
  // Both post to 1201 (input) and 2202 (output); net VAT position = 0
}

/** Standard rated supply at any % rate (20 for full, 5 for reduced) */
export function calcStandardRated(net: number, rate = 20): VATResult {
  const vatAmount = parseFloat((net * (rate / 100)).toFixed(2))
  return {
    net,
    vatAmount,
    gross: net + vatAmount,
    includesVATLine: true,
    includeInBox6: true,
  }
}

/** Zero-rated supply (0%): no VAT line, but included in Box 6 turnover */
export function calcZeroRated(net: number): VATResult {
  return {
    net,
    vatAmount: 0,
    gross: net,
    includesVATLine: false,
    includeInBox6: true,
  }
}

/**
 * Exempt supply: no VAT charged, NOT included in Box 6.
 * VAT on costs for exempt supplies is not reclaimable.
 */
export function calcExempt(net: number): VATResult {
  return {
    net,
    vatAmount: 0,
    gross: net,
    includesVATLine: false,
    includeInBox6: false,
  }
}

/**
 * Reverse charge (import of services): buyer accounts for both
 * output VAT (Box 1) and input VAT (Box 4). Net VAT = 0.
 * GL: Dr 1201 VAT Input + Dr Expense / Cr 2202 VAT Output + Cr Creditor
 */
export function calcReverseCharge(net: number, rate = 20): ReverseChargeResult {
  const vat = parseFloat((net * (rate / 100)).toFixed(2))
  return { net, vatInput: vat, vatOutput: vat }
}

/**
 * Partial exemption: only a % of input VAT is reclaimable.
 * recoveryPct: 0–100 (entity-level setting)
 */
export function calcPartialExemption(
  grossInputVAT: number,
  recoveryPct: number
): { reclaimable: number; blocked: number } {
  const reclaimable = parseFloat((grossInputVAT * (recoveryPct / 100)).toFixed(2))
  return { reclaimable, blocked: parseFloat((grossInputVAT - reclaimable).toFixed(2)) }
}

/**
 * Determine which date a transaction belongs to for VAT purposes.
 * UK rule: use invoice date (tax point), not payment date.
 * Cash accounting scheme: use payment date.
 */
export function vatPeriodDate(
  invoiceDate: string,
  paymentDate: string | null,
  cashAccountingScheme: boolean
): string {
  if (cashAccountingScheme && paymentDate) return paymentDate
  return invoiceDate
}
