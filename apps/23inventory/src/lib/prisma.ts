import { PrismaClient } from '../generated/client'

declare global {
  // eslint-disable-next-line no-var
  var _inventoryPrisma: PrismaClient | undefined
}

export const prisma = globalThis._inventoryPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis._inventoryPrisma = prisma
}

export default prisma
