-- Timestamps were written by the Prisma D1 adapter as ISO 8601 text with a
-- +00:00 offset. Drizzle stores them as integer milliseconds, and SQLite
-- compares INTEGER against TEXT by storage class before value, so the two
-- cannot coexist: a numeric bind would match no existing row and availability
-- checks would stop seeing conflicts. See ADR-0001.
--
-- Every table is rebuilt because every table has a timestamp. Autoincrement
-- sequences are restored explicitly: bookings has gaps from deleted rows, and
-- letting the counter derive from max(id) would reuse those ids.

PRAGMA defer_foreign_keys = on;
--> statement-breakpoint
ALTER TABLE `users` RENAME TO `old_users`;--> statement-breakpoint
ALTER TABLE `rooms` RENAME TO `old_rooms`;--> statement-breakpoint
ALTER TABLE `external_venues` RENAME TO `old_external_venues`;--> statement-breakpoint
ALTER TABLE `bookings` RENAME TO `old_bookings`;--> statement-breakpoint
ALTER TABLE `recurring_patterns` RENAME TO `old_recurring_patterns`;--> statement-breakpoint
ALTER TABLE `push_subscriptions` RENAME TO `old_push_subscriptions`;--> statement-breakpoint

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`is_rooms_admin` integer DEFAULT false NOT NULL,
	`notification_channels` text DEFAULT '["EMAIL"]' NOT NULL,
	`notification_preferences` text DEFAULT '["BOOKING_UPDATES"]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`capacity` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `external_venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campus` text,
	`building` text NOT NULL,
	`room_name` text NOT NULL,
	`contact_details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`room_id` integer,
	`external_venue_id` integer,
	`event_title` text NOT NULL,
	`number_of_attendees` integer,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`notes` text,
	`rejection_reason` text,
	`parent_booking_id` integer,
	`occurrence_number` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`external_venue_id`) REFERENCES `external_venues`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`parent_booking_id`) REFERENCES `bookings`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_patterns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`frequency` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`days_of_week` text,
	`max_occurrences` integer NOT NULL,
	`end_date` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `users` (`id`, `email`, `name`, `is_rooms_admin`, `notification_channels`, `notification_preferences`, `created_at`)
SELECT `id`, `email`, `name`, `is_rooms_admin`, `notification_channels`, `notification_preferences`,
       CAST(unixepoch(`created_at`, 'subsec') * 1000 AS INTEGER)
FROM `old_users`;
--> statement-breakpoint
INSERT INTO `rooms` (`id`, `name`, `description`, `capacity`, `is_active`, `created_at`)
SELECT `id`, `name`, `description`, `capacity`, `is_active`,
       CAST(unixepoch(`created_at`, 'subsec') * 1000 AS INTEGER)
FROM `old_rooms`;
--> statement-breakpoint
INSERT INTO `external_venues` (`id`, `campus`, `building`, `room_name`, `contact_details`, `created_at`)
SELECT `id`, `campus`, `building`, `room_name`, `contact_details`,
       CAST(unixepoch(`created_at`, 'subsec') * 1000 AS INTEGER)
FROM `old_external_venues`;
--> statement-breakpoint
INSERT INTO `bookings` (`id`, `user_id`, `room_id`, `external_venue_id`, `event_title`, `number_of_attendees`, `start_time`, `end_time`, `status`, `notes`, `rejection_reason`, `parent_booking_id`, `occurrence_number`, `created_at`)
SELECT `id`, `user_id`, `room_id`, `external_venue_id`, `event_title`, `number_of_attendees`,
       CAST(unixepoch(`start_time`, 'subsec') * 1000 AS INTEGER),
       CAST(unixepoch(`end_time`, 'subsec') * 1000 AS INTEGER),
       `status`, `notes`, `rejection_reason`, `parent_booking_id`, `occurrence_number`,
       CAST(unixepoch(`created_at`, 'subsec') * 1000 AS INTEGER)
FROM `old_bookings`;
--> statement-breakpoint
INSERT INTO `recurring_patterns` (`id`, `booking_id`, `frequency`, `interval`, `days_of_week`, `max_occurrences`, `end_date`, `created_at`)
SELECT `id`, `booking_id`, `frequency`, `interval`, `days_of_week`, `max_occurrences`,
       CAST(unixepoch(`end_date`, 'subsec') * 1000 AS INTEGER),
       CAST(unixepoch(`created_at`, 'subsec') * 1000 AS INTEGER)
FROM `old_recurring_patterns`;
--> statement-breakpoint
INSERT INTO `push_subscriptions` (`id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`)
SELECT `id`, `user_id`, `endpoint`, `p256dh`, `auth`,
       CAST(unixepoch(`created_at`, 'subsec') * 1000 AS INTEGER)
FROM `old_push_subscriptions`;
--> statement-breakpoint

UPDATE `sqlite_sequence`
SET `seq` = (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'old_bookings')
WHERE `name` = 'bookings' AND EXISTS (SELECT 1 FROM `sqlite_sequence` WHERE `name` = 'old_bookings');
--> statement-breakpoint
UPDATE `sqlite_sequence`
SET `seq` = (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'old_rooms')
WHERE `name` = 'rooms' AND EXISTS (SELECT 1 FROM `sqlite_sequence` WHERE `name` = 'old_rooms');
--> statement-breakpoint
UPDATE `sqlite_sequence`
SET `seq` = (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'old_external_venues')
WHERE `name` = 'external_venues' AND EXISTS (SELECT 1 FROM `sqlite_sequence` WHERE `name` = 'old_external_venues');
--> statement-breakpoint
UPDATE `sqlite_sequence`
SET `seq` = (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'old_recurring_patterns')
WHERE `name` = 'recurring_patterns' AND EXISTS (SELECT 1 FROM `sqlite_sequence` WHERE `name` = 'old_recurring_patterns');
--> statement-breakpoint
DROP TABLE `old_recurring_patterns`;--> statement-breakpoint
DROP TABLE `old_push_subscriptions`;--> statement-breakpoint
DROP TABLE `old_bookings`;--> statement-breakpoint
DROP TABLE `old_external_venues`;--> statement-breakpoint
DROP TABLE `old_rooms`;--> statement-breakpoint
DROP TABLE `old_users`;--> statement-breakpoint

CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_key` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_patterns_booking_id_key` ON `recurring_patterns` (`booking_id`);--> statement-breakpoint
CREATE INDEX `bookings_parent_booking_id_idx` ON `bookings` (`parent_booking_id`);--> statement-breakpoint
CREATE INDEX `bookings_start_time_end_time_idx` ON `bookings` (`start_time`,`end_time`);--> statement-breakpoint
CREATE INDEX `bookings_room_id_start_time_end_time_idx` ON `bookings` (`room_id`,`start_time`,`end_time`);
