import pool from '@/lib/pool'

export const query = (sql: string, params?: unknown[]) => pool.query(sql, params as any[])
export default pool
