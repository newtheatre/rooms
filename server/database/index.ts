/**
 * The Prisma client, as a singleton. Uses the D1 adapter in production and a
 * local SQLite file in development.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

/**
 * SQLite directly in development, the D1 adapter in production.
 */
const prismaClientSingleton = () => {
  if (process.env.NODE_ENV !== 'production') {
    return new PrismaClient({
      log: ['query', 'error', 'warn']
    })
  }

  // @ts-expect-error - env is available in Cloudflare Workers runtime and adapter is supported
  const adapter = new PrismaD1(process.env.DB)

  return new PrismaClient({ adapter, log: ['error'] })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

/**
 * A global, so HMR does not open a second client in development.
 */
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

/**
 * Graceful shutdown handler
 *
 * Ensures database connections are properly closed when the server stops.
 */
export async function disconnectDatabase() {
  await prisma.$disconnect()
}

export default prisma
