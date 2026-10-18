/** Events streamed from the annotation backend (and the mock) to the client. */

export interface AnnotationStats {
  valid: number
  dropped: number
  /** Server-side ms from request received to the model's first token. */
  firstTokenMs: number | null
  /** Server-side ms from request received to the first valid element. */
  firstElementMs: number | null
  totalMs: number
  /** The answer stopped early (output limit or unclosed JSON). */
  truncated: boolean
  finishReason?: string
}

export type AnnotationErrorCode =
  | 'invalid'
  | 'upstream'
  | 'busy'
  | 'timeout'
  | 'bad_request'
  | 'rate_limited'
  | 'frame_expired'
  | 'network'
  | 'offline'

export type AnnotationEvent =
  /** Untrusted until validated with ARElementSchema. */
  | { type: 'element'; element: unknown }
  | { type: 'done'; summary?: string; stats: AnnotationStats }
  | { type: 'error'; code: AnnotationErrorCode; message: string; retryable: boolean }
