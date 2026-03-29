// Run: npx tsx src/lib/__tests__/vat-engine.test.ts

import {
  calcStandardRated,
  calcZeroRated,
  calcExempt,
  calcReverseCharge,
} from '../vat.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

function run() {
  // Standard rated 20%
  const sr = calcStandardRated(1000)
  assert(sr.vatAmount === 200, 'standard rated: VAT = 200')
  assert(sr.gross === 1200, 'standard rated: gross = 1200')
  assert(sr.includesVATLine === true, 'standard rated: includes VAT line')

  // Zero rated
  const zr = calcZeroRated(500)
  assert(zr.vatAmount === 0, 'zero rated: no VAT')
  assert(zr.gross === 500, 'zero rated: gross = net')
  assert(zr.includesVATLine === false, 'zero rated: no VAT line')

  // Exempt
  const ex = calcExempt(300)
  assert(ex.vatAmount === 0, 'exempt: no VAT')
  assert(ex.includeInBox6 === false, 'exempt: not in box 6')

  // Reverse charge: net effect on VAT is zero
  const rc = calcReverseCharge(400, 20)
  assert(rc.vatInput === 80, 'reverse charge: input = 80')
  assert(rc.vatOutput === 80, 'reverse charge: output = 80')
  assert(rc.vatInput - rc.vatOutput === 0, 'reverse charge: net VAT = 0')

  console.log('\nAll VAT engine tests passed.')
  process.exit(0)
}

run()
