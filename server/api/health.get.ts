/** GET /api/health — uptime check (public). */
export default defineEventHandler(() => {
  return { ok: true }
})
