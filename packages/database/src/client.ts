import { PrismaClient } from '../dist'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn']
  })

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = db
