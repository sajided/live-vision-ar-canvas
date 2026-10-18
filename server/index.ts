import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { annotateStream } from './annotate'
import { env } from './env'
import { FrameCache } from './frameCache'
import { streamGemma, warmUp, type GemmaMeta } from './gemma'
import { RateLimiter } from './rateLimit'
import { retryBeforeFirstChunk } from './upstream'

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024
const MAX_QUERY_LENGTH = 500
const TIMEOUT_MS = 30_000
const UPSTREAM_RETRY_DELAY_MS = 800
const IMAGE_TYPES = new Set(['image/webp', 'image/jpeg'])

const Pct = z.number().min(0).max(100)
const ContentRectSchema = z.strictObject({ x: Pct, y: Pct, width: Pct, height: Pct })

// Frames uploaded at capture time live here briefly (memory only, never disk).
const frames = new FrameCache({ ttlMs: 2 * 60_000, maxEntries: 200, maxBytes: 100 * 1024 * 1024 })
const askLimiter = new RateLimiter({ capacity: 10, perMinute: 10 })
const uploadLimiter = new RateLimiter({ capacity: 20, perMinute: 30 })

function parseJson(value: unknown): unknown {
  try {
    return JSON.parse(String(value))
  } catch {
    return null
  }
}

function clientKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || getConnInfo(c).remote.address || 'unknown'
}

function rateLimited(c: Context, retryAfter: number) {
  c.header('Retry-After', String(retryAfter))
  return c.json({ error: `Too many requests — try again in ${retryAfter}s`, code: 'rate_limited' }, 429)
}

function validImage(image: unknown): image is File {
  return image instanceof File && IMAGE_TYPES.has(image.type)
}

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true, model: env.GEMMA_MODEL }))

/** Upload a frame ahead of the question; returns an id valid for ~2 minutes. */
app.post('/api/frames', async (c) => {
  const wait = uploadLimiter.take(clientKey(c))
  if (wait) return rateLimited(c, wait)
  const form = await c.req.formData().catch(() => null)
  const image = form?.get('image')
  if (!validImage(image)) return c.json({ error: 'Expected a WebP or JPEG image', code: 'bad_request' }, 400)
  if (image.size > MAX_IMAGE_BYTES) return c.json({ error: 'Image is too large', code: 'bad_request' }, 413)
  const frameId = frames.put(new Uint8Array(await image.arrayBuffer()), image.type)
  return c.json({ frameId })
})

app.post('/api/annotate', async (c) => {
  const received = performance.now()
  const wait = askLimiter.take(clientKey(c))
  if (wait) return rateLimited(c, wait)

  const form = await c.req.formData().catch(() => null)
  const query = form?.get('query') ?? ''
  const rect = ContentRectSchema.safeParse(parseJson(form?.get('contentRect')))
  if (typeof query !== 'string' || query.length > MAX_QUERY_LENGTH) {
    return c.json({ error: 'Question is too long', code: 'bad_request' }, 400)
  }
  if (!rect.success) return c.json({ error: 'Invalid contentRect', code: 'bad_request' }, 400)

  // Either a frame uploaded earlier (by id) or the image inline.
  let bytes: Uint8Array
  let mimeType: string
  const frameId = form?.get('frameId')
  if (typeof frameId === 'string' && frameId) {
    const cached = frames.get(frameId)
    if (!cached) return c.json({ error: 'Frame expired — sending it again', code: 'frame_expired' }, 410)
    ;({ bytes, mimeType } = cached)
  } else {
    const image = form?.get('image')
    if (!validImage(image)) return c.json({ error: 'Expected a WebP or JPEG image', code: 'bad_request' }, 400)
    if (image.size > MAX_IMAGE_BYTES) return c.json({ error: 'Image is too large', code: 'bad_request' }, 413)
    bytes = new Uint8Array(await image.arrayBuffer())
    mimeType = image.type
  }
  const bodyMs = performance.now() - received

  return streamSSE(c, async (stream) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('Model timed out', 'TimeoutError')), TIMEOUT_MS)
    stream.onAbort(() => controller.abort())

    const meta: GemmaMeta = {}
    const chunks = retryBeforeFirstChunk(
      () => streamGemma({ image: bytes, mimeType, query, contentRect: rect.data, signal: controller.signal, meta }),
      { retries: 1, delayMs: UPSTREAM_RETRY_DELAY_MS, signal: controller.signal },
    )
    try {
      for await (const event of annotateStream(chunks, { signal: controller.signal, start: received, meta })) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
        if (event.type === 'done') {
          const s = event.stats
          const ms = (v: number | null) => (v === null ? '–' : v.toFixed(0))
          console.info(
            `[annotate] ${s.valid} elements (${s.dropped} dropped)${s.truncated ? ' TRUNCATED' : ''} | ` +
              `body ${ms(bodyMs)} · first token ${ms(s.firstTokenMs)} · first element ${ms(s.firstElementMs)} · ` +
              `total ${ms(s.totalMs)} ms | ${frameId ? 'cached frame' : 'inline image'}, finish ${s.finishReason ?? '?'}`,
          )
        } else if (event.type === 'error') {
          console.warn(`[annotate] error ${event.code}: ${event.message}`)
        }
      }
      if (controller.signal.aborted && controller.signal.reason?.name !== 'TimeoutError') {
        console.info('[annotate] client aborted')
      }
    } finally {
      clearTimeout(timer)
    }
  })
})

// Production: serve the built client from the same origin.
app.use('/*', serveStatic({ root: './dist' }))

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.info(`[server] listening on http://localhost:${port} (model ${env.GEMMA_MODEL})`)
  if (env.GEMMA_WARMUP) void warmUp()
})
