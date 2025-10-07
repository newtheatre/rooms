// auth.d.ts
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: 'STANDARD' | 'ADMIN'
  }

  interface UserSession {
    loggedInAt: Date
  }

  interface SecureSessionData {
    // Add any secure server-only data here
    // For now, keeping empty - add properties as needed
    [key: string]: unknown
  }
}

export {}
