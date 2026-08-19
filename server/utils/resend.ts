import { Resend } from 'resend'

let client: Resend | null = null

/**
 * Returns null rather than throwing when no key is set, so email degrades to a
 * no-op instead of failing the build and the Worker.
 */
export function getResend(): Resend | null {
  if (client) return client

  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Not memoised: pinning a failed read would disable email for the life of
    // the isolate, as 0.secrets-store.ts already learned.
    console.warn('[Email] No Resend API key configured; email sending is disabled.')
    return null
  }

  client = new Resend(key)
  return client
}
