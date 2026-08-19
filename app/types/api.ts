/** Shapes the booking forms read back from the list endpoints. */

export interface RoomOption {
  id: number
  name: string
  description?: string | null
  capacity?: number | null
  isActive?: boolean
  // Present only when the room came from /api/rooms/available.
  conflicts?: Array<{ id: number }>
}

export interface VenueOption {
  id: number
  campus?: string | null
  building: string
  roomName: string
  contactDetails?: string | null
}

export interface UserOption {
  id: string
  name: string
  email: string
}
