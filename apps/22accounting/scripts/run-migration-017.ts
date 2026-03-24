import * as fs from 'fs';
import * as path from 'path';
import { query } from '@/src/lib/db';

async function run() {
  console.log('=== Migration 017: Period Locks ===\n');
  const sql = fs.readFileSync(path.join(__dirname, 'migration-017-period-locks.sql'), 'utf8');
  await query(sql);
  console.log('Migration 017 complete.');
  process.exit(0);
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
