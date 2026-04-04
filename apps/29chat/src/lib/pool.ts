import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export default pool
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}
