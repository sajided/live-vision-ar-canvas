import type { AnnotationEvent } from '../src/ar/events'

type ErrorEvent = Extract<AnnotationEvent, { type: 'error' }>

/** HTTP status of an upstream (Gemini API) error, if it has one. */
export function upstreamStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : undefined
}

/** Errors worth one more attempt: rate limits, server errors and dropped connections. */
export function isRetryableUpstream(err: unknown): boolean {
  const status = upstreamStatus(err)
  return status === undefined || status === 429 || status >= 500
}

export function upstreamErrorEvent(err: unknown): ErrorEvent {
  const status = upstreamStatus(err)
  if (status === 429) {
    return { type: 'error', code: 'busy', message: 'The tutor is busy — try again in a moment.', retryable: true }
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return { type: 'error', code: 'upstream', message: 'The vision model rejected this request.', retryable: false }
  }
  return { type: 'error', code: 'upstream', message: 'The vision model is unavailable right now.', retryable: true }
}

interface RetryOptions {
  retries: number
  delayMs: number
  signal?: AbortSignal
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(timer), reject(signal.reason)), { once: true })
  })

/**
 * Re-run `factory` after a retryable failure, but only before the first chunk:
 * once text has been streamed to the client, a retry would duplicate it.
 */
export async function* retryBeforeFirstChunk<T>(
  factory: () => AsyncIterable<T>,
  { retries, delayMs, signal }: RetryOptions,
): AsyncGenerator<T> {
  for (let attempt = 0; ; attempt++) {
    let started = false
    try {
      for await (const chunk of factory()) {
        started = true
        yield chunk
      }
      return
    } catch (err) {
      if (started || attempt >= retries || signal?.aborted || !isRetryableUpstream(err)) throw err
      console.warn(`[upstream] attempt ${attempt + 1} failed (${upstreamStatus(err) ?? 'network'}), retrying`)
      await sleep(delayMs * (attempt + 1), signal)
    }
  }
}
