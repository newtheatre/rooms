/**
 * What this app declares to the auth service: its role namespace, the roles it
 * reads, and the permissions each one carries. Served at /api/_hooks/auth/manifest.
 */

export const APP_MANIFEST = {
  contract: 1,
  namespace: 'rooms',
  version: '1',

  // Named capabilities, so a check says what it means rather than which role
  // happens to imply it.
  permissions: [
    { key: 'admin.access', description: 'Reach the room-booking admin surface' },
    { key: 'booking.read.any', description: 'See any booking, including who booked and the event title' },
    { key: 'booking.manage.any', description: 'Edit or cancel anyone\'s booking' },
    { key: 'room.read.inactive', description: 'See rooms and venues that are not published' }
  ],

  roles: [
    {
      role: 'ADMIN',
      description: 'Room-booking admin. Logged in is enough to request a booking.',
      defaultExpiry: { kind: 'committee-year' },
      permissions: ['admin.access', 'booking.read.any', 'booking.manage.any', 'room.read.inactive'],
      requiresEligibility: null
    }
  ],

  eligibilityRules: []
} as const

export type AppManifest = typeof APP_MANIFEST
