import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { CapturedFrame } from '../types/frame'
import { annotationReducer, initialAnnotationState } from './annotationState'
import type { AnnotationEvent } from './events'
import { ARElementSchema } from './schema'
import { prefersReducedMotion } from './motionPrefs'
import { traceDuration } from './trace'

/** Streams raw annotation events for a frame and question. */
export type Annotator = (frame: CapturedFrame, query: string, signal: AbortSignal) => AsyncIterable<AnnotationEvent>

export interface RequestResult {
  error: string | null
  summary: string | null
  /** Elements put on screen by this request. */
  shown: number
  /** The answer stopped early; the UI offers a retry. */
  truncated: boolean
}

/** One finished request, for on-device benchmarking. */
export interface RunRecord {
  at: string
  shown: number
  truncated: boolean
  firstElementMs: number | null
  totalMs: number
  serverFirstTokenMs: number | null
  serverFirstElementMs: number | null
}

const HISTORY_LENGTH = 10

export interface AnnotationMetrics {
  ok: number
  invalid: number
  dropped: number
  truncated: number
  /** Client-side time from request to first element on screen. */
  firstElementMs: number | null
  totalMs: number | null
  /** Server-side timings from the last answer. */
  serverFirstTokenMs: number | null
  serverFirstElementMs: number | null
  history: RunRecord[]
}

const MAX_ATTEMPTS = 2
/** A cut-off answer with fewer elements than this is retried rather than shown. */
const MIN_USEFUL_ELEMENTS = 3
const PARSE_ERROR = "Couldn't read the answer — try again"
const CUT_OFF = 'The answer was cut off'

const NOTHING: RequestResult = { error: null, summary: null, shown: 0, truncated: false }

export function useAnnotations(annotate: Annotator) {
  const [state, dispatch] = useReducer(annotationReducer, initialAnnotationState)
  const [metrics, setMetrics] = useState<AnnotationMetrics>({
    ok: 0,
    invalid: 0,
    dropped: 0,
    truncated: 0,
    firstElementMs: null,
    totalMs: null,
    serverFirstTokenMs: null,
    serverFirstElementMs: null,
    history: [],
  })
  const controllerRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  useEffect(() => abort, [abort])

  const request = useCallback(
    async (frame: CapturedFrame, query: string): Promise<RequestResult> => {
      abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const start = performance.now()
      let firstElementMs: number | null = null

      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          // Each attempt starts from a clean slate (a retry replaces a partial answer).
          dispatch({ type: 'start' })
          let shown = 0
          let dropped = 0
          let failure: Extract<AnnotationEvent, { type: 'error' }> | null = null
          let done: Extract<AnnotationEvent, { type: 'done' }> | null = null

          for await (const event of annotate(frame, query, controller.signal)) {
            if (controller.signal.aborted) return NOTHING
            if (event.type === 'element') {
              // Re-validate on the client: the server is not trusted blindly (FR-3.2).
              const result = ARElementSchema.safeParse(event.element)
              if (!result.success) {
                dropped++
                continue
              }
              firstElementMs ??= performance.now() - start
              shown++
              dispatch({
                type: 'element',
                element: result.data,
                now: performance.now(),
                drawSeconds: prefersReducedMotion() ? 0 : traceDuration(result.data),
              })
            } else if (event.type === 'done') {
              done = event
            } else {
              failure = event
            }
          }
          if (controller.signal.aborted) return NOTHING

          const truncated = done?.stats.truncated ?? false
          setMetrics((m) => ({
            ...m,
            dropped: m.dropped + dropped,
            truncated: m.truncated + (truncated ? 1 : 0),
            ...(done && { serverFirstTokenMs: done.stats.firstTokenMs, serverFirstElementMs: done.stats.firstElementMs }),
          }))

          const lastAttempt = attempt === MAX_ATTEMPTS
          if (truncated && shown < MIN_USEFUL_ELEMENTS && !lastAttempt) {
            console.warn(`[ar] attempt ${attempt} was cut off after ${shown} elements, retrying`)
            firstElementMs = null
            continue
          }

          if (shown > 0) {
            const totalMs = performance.now() - start
            const record: RunRecord = {
              at: new Date().toISOString(),
              shown,
              truncated,
              firstElementMs,
              totalMs,
              serverFirstTokenMs: done?.stats.firstTokenMs ?? null,
              serverFirstElementMs: done?.stats.firstElementMs ?? null,
            }
            setMetrics((m) => ({
              ...m,
              ok: m.ok + 1,
              firstElementMs,
              totalMs,
              history: [...m.history, record].slice(-HISTORY_LENGTH),
            }))
            dispatch({ type: 'finish', ok: true })
            // A mid-stream failure after some elements still counts as a (partial) answer.
            return {
              error: failure ? failure.message : truncated ? CUT_OFF : null,
              summary: done?.summary ?? null,
              shown,
              truncated: truncated || failure !== null,
            }
          }

          const retryable = failure ? failure.retryable : true
          if (!failure || failure.code === 'invalid') setMetrics((m) => ({ ...m, invalid: m.invalid + 1 }))
          console.warn(`[ar] attempt ${attempt} produced no elements: ${failure?.message ?? 'empty stream'}`)
          if (!retryable || lastAttempt) {
            dispatch({ type: 'finish', ok: false })
            return { error: failure?.message ?? PARSE_ERROR, summary: null, shown: 0, truncated: false }
          }
        }
        return { error: PARSE_ERROR, summary: null, shown: 0, truncated: false }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    },
    [annotate, abort],
  )

  const reset = useCallback(() => {
    abort()
    dispatch({ type: 'reset' })
  }, [abort])

  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  const visible = useMemo(
    () => state.elements.filter((e) => !state.dismissed.has(e.id)),
    [state.elements, state.dismissed],
  )

  return {
    status: state.status,
    elements: state.elements,
    visible,
    delays: state.delays,
    metrics,
    request,
    dismiss,
    clear,
    reset,
  }
}
