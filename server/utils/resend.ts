import { Resend } from 'resend'

let client: Resend | null | undefined

/**
 * Returns null rather than throwing when no key is set, so email degrades to a
 * no-op instead of failing the build and the Worker.
 */
export function getResend(): Resend | null {
  if (client !== undefined) return client

  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[Email] No Resend API key configured; email sending is disabled.')
    client = null
    return null
  }

  client = new Resend(key)
  return client
}
