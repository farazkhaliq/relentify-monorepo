import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://relentify_user:relentify_pass@localhost:5432/relentify',
})

async function run() {
  const client = await pool.connect()
  try {
    // Ensure migration history table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_migration_history (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // Get already applied migrations
    const applied = await client.query('SELECT filename FROM ts_migration_history')
    const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename))

    // Read migration files sorted alphabetically
    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    let count = 0
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  SKIP ${file} (already applied)`)
        continue
      }

      console.log(`  APPLYING ${file}...`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO ts_migration_history (filename) VALUES ($1)',
          [file]
        )
        await client.query('COMMIT')
        console.log(`  ✅ ${file}`)
        count++
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  ❌ ${file} FAILED:`, err)
        throw err
      }
    }

    console.log(`\nMigrations complete: ${count} applied, ${appliedSet.size} already applied`)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
