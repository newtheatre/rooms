import { sqliteTable, text, integer, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { users } from './user'
import { rooms, externalVenues } from './venue'

export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'AWAITING_EXTERNAL', 'REJECTED', 'CANCELLED'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'CUSTOM'] as const
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

/**
 * A request for a space and a window. Either roomId or externalVenueId is set,
 * never both. Status lifecycle: docs/data-model.md#bookings
 */
export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  roomId: integer('room_id').references(() => rooms.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  externalVenueId: integer('external_venue_id').references(() => externalVenues.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  eventTitle: text('event_title').notNull(),
  numberOfAttendees: integer('number_of_attendees'),
  startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp_ms' }).notNull(),
  status: text('status', { enum: BOOKING_STATUSES }).notNull().default('PENDING'),
  notes: text('notes'),
  rejectionReason: text('rejection_reason'),

  // Occurrences of a series are individual rows (CLAUDE.md invariant 5).
  parentBookingId: integer('parent_booking_id').references((): AnySQLiteColumn => bookings.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  occurrenceNumber: integer('occurrence_number'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
}, table => [
  index('bookings_parent_booking_id_idx').on(table.parentBookingId),
  index('bookings_start_time_end_time_idx').on(table.startTime, table.endTime),
  index('bookings_room_id_start_time_end_time_idx').on(table.roomId, table.startTime, table.endTime)
])

/**
 * Attached to the parent booking of a series. Expanded once, at creation.
 * Fields and limits: docs/data-model.md#recurring_patterns
 */
export const recurringPatterns = sqliteTable('recurring_patterns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  frequency: text('frequency', { enum: RECURRENCE_FREQUENCIES }).notNull(),
  interval: integer('interval').notNull().default(1),

  // JSON array of weekday numbers, or null. Only meaningful for WEEKLY.
  daysOfWeek: text('days_of_week'),

  maxOccurrences: integer('max_occurrences').notNull(),
  endDate: integer('end_date', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
}, table => [
  uniqueIndex('recurring_patterns_booking_id_key').on(table.bookingId)
])

export type Booking = typeof bookings.$inferSelect
export type RecurringPattern = typeof recurringPatterns.$inferSelect
