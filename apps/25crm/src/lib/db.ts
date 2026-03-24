import { db } from '@relentify/database'
export default db

export async function query(text: string, params?: any[]) {
  // Using $queryRaw to maintain backward compatibility with raw SQL queries in CRM
  return db.$queryRawUnsafe(text, ...(params || []))
}
