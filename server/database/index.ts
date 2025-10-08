/**
 * Database Connection and Prisma Client
 *
 * This module exports a singleton instance of the Prisma Client
 * for use across the Nuxt server API routes.
 * Handles Cloudflare D1 adapter in production.
 *
 * @module server/database
 */

import { PrismaClient } from '~~/.generated/client'
import { PrismaD1 } from '@prisma/adapter-d1'

/**
 * Prisma Client singleton factory
 *
 * In development, uses SQLite directly.
 * In production, uses Cloudflare D1 adapter.
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
 * Global Prisma Client instance
 *
 * Uses a global variable to prevent multiple instances in development
 * due to hot module replacement.
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
