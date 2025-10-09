-- CreateTable
CREATE TABLE "recurring_patterns" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "booking_id" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "days_of_week" TEXT,
    "max_occurrences" INTEGER NOT NULL,
    "end_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recurring_patterns_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bookings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT,
    "room_id" INTEGER,
    "external_venue_id" INTEGER,
    "event_title" TEXT NOT NULL,
    "number_of_attendees" INTEGER,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "rejection_reason" TEXT,
    "parent_booking_id" INTEGER,
    "occurrence_number" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_external_venue_id_fkey" FOREIGN KEY ("external_venue_id") REFERENCES "external_venues" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_parent_booking_id_fkey" FOREIGN KEY ("parent_booking_id") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_bookings" ("created_at", "end_time", "event_title", "external_venue_id", "id", "notes", "number_of_attendees", "rejection_reason", "room_id", "start_time", "status", "user_id") SELECT "created_at", "end_time", "event_title", "external_venue_id", "id", "notes", "number_of_attendees", "rejection_reason", "room_id", "start_time", "status", "user_id" FROM "bookings";
DROP TABLE "bookings";
ALTER TABLE "new_bookings" RENAME TO "bookings";
CREATE INDEX "bookings_parent_booking_id_idx" ON "bookings"("parent_booking_id");
CREATE INDEX "bookings_start_time_end_time_idx" ON "bookings"("start_time", "end_time");
CREATE INDEX "bookings_room_id_start_time_end_time_idx" ON "bookings"("room_id", "start_time", "end_time");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "recurring_patterns_booking_id_key" ON "recurring_patterns"("booking_id");
