import { app } from '../server/app.js'

/**
 * Vercel Function: every /api/* request is rewritten here (vercel.json) and
 * handled by the same Hono app as local development.
 */
export default {
  fetch: (request: Request) => app.fetch(request),
}
