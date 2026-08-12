/**
 * POST /api/users
 *
 * Create a user to attach a booking to (admin only).
 *
 * Identity lives in the central auth service — this endpoint asks it for a
 * shadow account (match-or-create by email, service-token authenticated)
 * and mirrors the result locally. No passwords are generated or returned;
 * the person can claim the account later via the auth service. Full account
 * management happens at auth.newtheatre.org.uk/admin.
 *
 * Request body:
 * - name: string (1-255 chars)
 * - email: string (valid email)
 *
 * Returns: the mirrored user { id, email, name, existing }
 */
import prisma from '~~/server/database'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Create user (shadow account via the auth service)',
    description: 'Match-or-create a central shadow account and mirror it locally (admin only)',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'email'],
            properties: {
              name: { type: 'string', description: 'User name' },
              email: { type: 'string', format: 'email', description: 'User email' }
            }
          }
        }
      }
    },
    responses: {
      200: { description: 'User created or matched' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not an admin' },
      502: { description: 'Auth service unavailable' }
    }
  }
})

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().transform(v => v.toLowerCase())
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const validation = createUserSchema.safeParse(body)
  if (!validation.success) {
    throw createError({ statusCode: 400, message: 'Invalid name or email' })
  }
  const { name, email } = validation.data

  const config = useRuntimeConfig(event)
  if (!config.authServiceToken) {
    throw createError({ statusCode: 502, message: 'Auth service token not configured' })
  }

  let shadow: { id: string, existing: boolean }
  try {
    shadow = await $fetch<{ id: string, existing: boolean }>(
      `${config.public.authBaseURL}/api/users/shadow`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.authServiceToken}` },
        body: { email, name }
      }
    )
  } catch (error) {
    console.error('[users] shadow-create failed:', error)
    throw createError({ statusCode: 502, message: 'Could not reach the auth service — try again' })
  }

  const user = await prisma.user.upsert({
    where: { id: shadow.id },
    update: { email, name },
    create: { id: shadow.id, email, name }
  })

  return { id: user.id, email: user.email, name: user.name, existing: shadow.existing }
})
