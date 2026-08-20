/**
 * The one write path into the user mirror. An erased row is never written back
 * over, whichever caller is asking (ADR-0005).
 */

import { db, schema } from '@nuxthub/db'
import { isNull } from 'drizzle-orm'

export interface MirroredUser {
  id: string
  email: string
  name: string
  isRoomsAdmin?: boolean
}

/** `email` is unique, and ON CONFLICT (id) does not catch a clash on it. */
function isEmailCollision(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE constraint failed: users.email')
}

/** Distinct per id, so two mirrored placeholders cannot collide either. */
function placeholderEmail(userId: string): string {
  return `unmirrored-${userId}@placeholder.invalid`
}

function upsert(user: MirroredUser, email: string) {
  const set = {
    email,
    name: user.name,
    ...(user.isRoomsAdmin !== undefined && { isRoomsAdmin: user.isRoomsAdmin })
  }

  return db
    .insert(schema.users)
    .values({ ...set, id: user.id })
    .onConflictDoUpdate({
      target: schema.users.id,
      set,
      // Never resurrect an erased account: the sealed cookie stays readable
      // after erasure and would write their details back (ADR-0005).
      setWhere: isNull(schema.users.anonymisedAt)
    })
    .returning()
}

/** Returns the row as it now stands, or undefined if erasure held the write off. */
export async function upsertMirroredUser(user: MirroredUser) {
  try {
    return firstRow(await upsert(user, user.email))
  } catch (error) {
    if (!isEmailCollision(error)) throw error

    // Another id already holds this address, which is the pre-merge shadow
    // account state. Mirror everything but the email rather than 500 (ADR-0004).
    console.warn(`[mirror] ${user.email} is held by another id; mirrored ${user.id} without it.`)
    return firstRow(await upsert(user, placeholderEmail(user.id)))
  }
}
