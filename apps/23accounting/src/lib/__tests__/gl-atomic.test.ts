// Integration test — requires live DB
// Run: npx tsx src/lib/__tests__/gl-atomic.test.ts

import { query } from '../db'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

async function getTestContext() {
  const r = await query(`
    SELECT u.id as user_id, e.id as entity_id
    FROM users u JOIN entities e ON e.user_id = u.id
    WHERE e.is_active = TRUE LIMIT 1
  `)
  if (r.rows.length === 0) throw new Error('No test entity found')
  return r.rows[0] as { user_id: string; entity_id: string }
}

async function run() {
  const ctx = await getTestContext()

  // Test: GL entry exists after createInvoice
  const { createInvoice } = await import('../invoice.service')
  const inv = await createInvoice({
    userId: ctx.user_id,
    entityId: ctx.entity_id,
    clientName: 'GL Test Client',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    taxRate: 20,
    currency: 'GBP',
    items: [{ description: 'Test item', quantity: 1, unitPrice: 100, taxRate: 20 }],
  })

  const glR = await query(
    `SELECT je.id FROM acc_journal_entries je
     WHERE je.source_type='invoice' AND je.source_id=$1`,
    [inv.id]
  )
  assert(glR.rows.length === 1, `GL entry created for invoice ${inv.id}`)

  // Cleanup
  await query(`DELETE FROM acc_journal_lines WHERE entry_id = $1`, [glR.rows[0].id])
  await query(`DELETE FROM acc_journal_entries WHERE id = $1`, [glR.rows[0].id])
  await query(`DELETE FROM acc_invoice_items WHERE invoice_id = $1`, [inv.id])
  await query(`DELETE FROM acc_invoices WHERE id = $1`, [inv.id])

  console.log('\nAll GL atomic tests passed.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
