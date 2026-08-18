import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * Rooms the theatre controls directly. Deactivated rather than deleted, so
 * booking history stays readable.
 */
export const rooms = sqliteTable('rooms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  capacity: integer('capacity'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
})

/**
 * Third-party spaces. No deactivated state, so deletion is refused while any
 * booking references one.
 */
export const externalVenues = sqliteTable('external_venues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  campus: text('campus'),
  building: text('building').notNull(),
  roomName: text('room_name').notNull(),
  contactDetails: text('contact_details'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
})

export type Room = typeof rooms.$inferSelect
export type ExternalVenue = typeof externalVenues.$inferSelect
