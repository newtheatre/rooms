import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Mirror of the central NNT identity store. Ids are canonical auth-service
 * ids and are never minted here (CLAUDE.md invariant 2).
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),

  /**
   * A cache for notification fan-out, refreshed from the session.
   * Never gate access on it: the session is authoritative.
   */
  isRoomsAdmin: integer('is_rooms_admin', { mode: 'boolean' }).notNull().default(false),

  // JSON arrays, stored as text. Values: docs/data-model.md#users
  notificationChannels: text('notification_channels').notNull().default('["EMAIL"]'),
  notificationPreferences: text('notification_preferences').notNull().default('["BOOKING_UPDATES"]'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
}, table => [
  // Index names match the live tables, which Prisma created (ADR-0001).
  uniqueIndex('users_email_key').on(table.email)
])

/**
 * One row per device. NOTHING SENDS TO THESE: sendPushNotification is a stub
 * (README §Known gaps).
 */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
}, table => [
  uniqueIndex('push_subscriptions_endpoint_key').on(table.endpoint)
])

export type User = typeof users.$inferSelect
export type PushSubscription = typeof pushSubscriptions.$inferSelect
