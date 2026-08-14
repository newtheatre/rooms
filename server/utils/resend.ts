import { Resend } from 'resend'

let client: Resend | null | undefined

/**
 * Lazily construct the Resend client, matching Proscenium's
 * server/utils/resend.ts.
 *
 * Returns null rather than throwing when no key is configured, so a missing
 * key degrades email to a no-op instead of taking the whole Worker down at
 * import time — which also meant the app could not be built without a secret.
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
