import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app.js'
import { env } from './env.js'
import { warmUp } from './gemma.js'

// Local / self-hosted Node server. On Vercel, api/index.ts serves the same app.

// Production: serve the built client from the same origin.
app.use('/*', serveStatic({ root: './dist' }))

if (!env.GEMINI_API_KEY) console.warn('[server] GEMINI_API_KEY is not set; questions will fail until it is added to .env')

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.info(`[server] listening on http://localhost:${port} (model ${env.GEMMA_MODEL})`)
  if (env.GEMMA_WARMUP) void warmUp()
})
