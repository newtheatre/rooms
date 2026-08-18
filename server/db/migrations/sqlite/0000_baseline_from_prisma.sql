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
CREATE INDEX `bookings_parent_booking_id_idx` ON `bookings` (`parent_booking_id`);--> statement-breakpoint
CREATE INDEX `bookings_start_time_end_time_idx` ON `bookings` (`start_time`,`end_time`);--> statement-breakpoint
CREATE INDEX `bookings_room_id_start_time_end_time_idx` ON `bookings` (`room_id`,`start_time`,`end_time`);--> statement-breakpoint
CREATE TABLE `external_venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campus` text,
	`building` text NOT NULL,
	`room_name` text NOT NULL,
	`contact_details` text,
	`created_at` integer NOT NULL
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
CREATE UNIQUE INDEX `push_subscriptions_endpoint_key` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `recurring_patterns_booking_id_key` ON `recurring_patterns` (`booking_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`capacity` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);