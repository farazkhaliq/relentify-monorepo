// Integration test — requires DB access
// Run: cd /opt/relentify-monorepo/apps/22accounting && npx tsx src/lib/__tests__/idempotency.test.ts

import { checkIdempotencyKey, storeIdempotencyKey, cleanExpiredKeys } from '../idempotency.service'
import { query } from '../db'

const TEST_ENTITY = '00000000-0000-0000-0000-000000000001'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

async function cleanup() {
  await query(`DELETE FROM idempotency_keys WHERE entity_id = $1`, [TEST_ENTITY])
}

async function run() {
  await cleanup()

  // Test 1: new key returns null
  const r1 = await checkIdempotencyKey('test-key-1', TEST_ENTITY)
  assert(r1 === null, 'new key returns null')

  // Test 2: after storing, same key returns the response
  await storeIdempotencyKey('test-key-1', TEST_ENTITY, { id: 'inv-1', status: 'ok' })
  const r2 = await checkIdempotencyKey('test-key-1', TEST_ENTITY)
  assert(r2 !== null && (r2 as { id: string }).id === 'inv-1', 'stored key returns response')

  // Test 3: different entity, same key → null (scoped)
  const r3 = await checkIdempotencyKey('test-key-1', '00000000-0000-0000-0000-000000000002')
  assert(r3 === null, 'key is scoped to entity')

  await cleanup()
  console.log('\nAll idempotency tests passed.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
