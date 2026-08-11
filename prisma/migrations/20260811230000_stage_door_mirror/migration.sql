-- Stage-door integration: slim users to the central-identity mirror.
-- Runs at cutover, AFTER the account migration populated the auth DB
-- (stage-door docs/migration.md#per-app-data-fixes).

PRAGMA defer_foreign_keys = on;

-- 1. Users merged with a Proscenium identity adopt their canonical id.
--    bookings.user_id and push_subscriptions.user_id follow via
--    ON UPDATE CASCADE. Rooms-only users kept their UUID (no-op).
UPDATE users SET id = '4m6r-2XtL92MOG32Jv7A3' WHERE id = 'a1e37a6f-1043-412c-8e76-4ba8ccf35884';
UPDATE users SET id = 'Xs1IJ98liFxiyA7MnUZNC' WHERE id = 'd39217d6-87d6-4bce-949f-2449c644c501';
UPDATE users SET id = 'KoEXqB52l781oRoM_DOJg' WHERE id = 'dad79211-f744-4831-a1a9-e5a874c9dba5';
UPDATE users SET id = '8f93cfa8c47d3c3d0adbb' WHERE id = 'f720fbd3-0656-47ed-8403-5d88b49afe9b';
UPDATE users SET id = '0e79bd6b2e3ef4fcd96ea' WHERE id = '09c11201-96fe-455a-b310-987e20ab5ee7';
UPDATE users SET id = '6fba03a59444a78806a20' WHERE id = '5d918c9b-964f-468c-b9a3-e91c7a0c058e';
UPDATE users SET id = '24f33784d310ea7f08631' WHERE id = '7b961fae-89b1-469a-8d8e-ddaa33ef223d';
UPDATE users SET id = '3cde180cec294d6bfb3c8' WHERE id = '89d0b0bc-5a6f-498e-b6e8-ad89907713c9';
UPDATE users SET id = '12e99068d9ea06c7dbc02' WHERE id = '91301cc0-0a39-42f9-a877-b418b23d38d9';
UPDATE users SET id = 'a8ae485feeca1d01f98c1' WHERE id = '8d9d6b95-50e7-4f5f-abe8-6adb62a47571';
UPDATE users SET id = 'ace9b654ff9f30d3823fb' WHERE id = '937696db-8029-457f-baa5-e40ebdaffb9c';
UPDATE users SET id = '1d65a55cf1f413460caf4' WHERE id = '43fd1174-2be1-4863-9332-b961b139a62a';
UPDATE users SET id = 'MIWACHhBswsltVvVF7UCz' WHERE id = '1a15aa0d-a661-4792-b8a2-24cc66e0825d';
UPDATE users SET id = 'V3f90gxQhMaQ5l6GxnAqe' WHERE id = 'feb6c64a-64f3-4369-b663-9c5490c2fdf2';
UPDATE users SET id = 'MSU2WE2e1NfU1kA0AdW-N' WHERE id = 'dd555ecc-4f2c-4f93-998a-34ba74eedb17';
UPDATE users SET id = 'esISuvKyVyqCB79dimC3q' WHERE id = '2625368c-bd8b-4a97-82e4-dd8558d52f57';

-- 2. Rebuild users as the thin mirror: drop password_hash and role
--    (credentials and roles live in the auth service), lowercase emails
--    to match the canonical store.
CREATE TABLE "users_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_rooms_admin" BOOLEAN NOT NULL DEFAULT false,
    "notification_channels" TEXT NOT NULL DEFAULT '["EMAIL"]',
    "notification_preferences" TEXT NOT NULL DEFAULT '["BOOKING_UPDATES"]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users_new (id, email, name, is_rooms_admin, notification_channels, notification_preferences, created_at)
  SELECT id, lower(email), name, CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END, notification_channels, notification_preferences, created_at FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
