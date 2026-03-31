import { db } from '@relentify/database'
export { db }

// For raw SQL queries, use pool directly
export { default as pool, query } from './pool'
