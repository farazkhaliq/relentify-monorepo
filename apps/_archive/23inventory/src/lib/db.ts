import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = (sql: string, params?: unknown[]) =>
  pool.query(sql, params as any[])

export default pool
