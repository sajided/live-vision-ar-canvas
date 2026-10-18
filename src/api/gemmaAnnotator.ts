import type { AnnotationErrorCode, AnnotationEvent } from '../ar/events'
import type { CapturedFrame } from '../types/frame'
import { readSSE } from './sse'

const EVENT_TYPES = new Set(['element', 'done', 'error'])

const networkError: AnnotationEvent = {
  type: 'error',
  code: 'network',
  message: 'Network error — check your connection',
  retryable: true,
}

const filename = (frame: CapturedFrame) => (frame.mimeType === 'image/webp' ? 'frame.webp' : 'frame.jpg')

// Upload per captured frame, started as soon as it is frozen (before the question is typed).
const uploads = new WeakMap<CapturedFrame, Promise<string | null>>()

/** Start uploading a frozen frame so asking only has to send text. Safe to call repeatedly. */
export function prefetchFrame(frame: CapturedFrame): Promise<string | null> {
  let upload = uploads.get(frame)
  if (!upload) {
    const body = new FormData()
    body.append('image', frame.blob, filename(frame))
    upload = fetch('/api/frames', { method: 'POST', body })
      .then((res) => (res.ok ? (res.json() as Promise<{ frameId: string }>) : null))
      .then((json) => json?.frameId ?? null)
      // Fall back to sending the image inline with the question.
      .catch(() => null)
    uploads.set(frame, upload)
  }
  return upload
}

/** Warm the connection to our server (TLS, proxy) before the first question. */
export function warmConnection(): void {
  fetch('/api/health').catch(() => {})
}

async function errorFromResponse(response: Response): Promise<AnnotationEvent> {
  const json = (await response.json().catch(() => ({}))) as { error?: string; code?: AnnotationErrorCode }
  const serverSide = response.status >= 500
  return {
    type: 'error',
    code: json.code ?? (serverSide ? 'upstream' : 'bad_request'),
    message: json.error ?? (serverSide ? 'The vision service is unavailable.' : `Request failed (${response.status})`),
    // A rate limit won't clear in time for an immediate retry.
    retryable: serverSide,
  }
}

/** Stream annotation events for a frame from the backend (`server/index.ts`). */
export async function* gemmaAnnotate(
  frame: CapturedFrame,
  query: string,
  signal: AbortSignal,
): AsyncGenerator<AnnotationEvent> {
  const send = async (frameId: string | null) => {
    const body = new FormData()
    if (frameId) body.append('frameId', frameId)
    else body.append('image', frame.blob, filename(frame))
    body.append('query', query)
    body.append('contentRect', JSON.stringify(frame.contentRect))
    return fetch('/api/annotate', { method: 'POST', body, signal })
  }

  let response: Response
  try {
    const frameId = await prefetchFrame(frame)
    response = await send(frameId)
    // The cached frame expired (server restart or >2 min): send it inline instead.
    if (frameId && response.status === 410) {
      uploads.delete(frame)
      response = await send(null)
    }
  } catch {
    if (!signal.aborted) yield networkError
    return
  }

  if (!response.ok || !response.body) {
    yield await errorFromResponse(response)
    return
  }

  try {
    for await (const { event, data } of readSSE(response.body)) {
      if (!EVENT_TYPES.has(event)) continue
      const parsed = JSON.parse(data) as AnnotationEvent
      if (parsed.type === event) yield parsed
    }
  } catch {
    if (!signal.aborted) yield networkError
  }
}
