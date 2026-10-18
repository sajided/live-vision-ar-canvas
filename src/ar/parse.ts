import { ARResponseSchema, type ARResponse } from './schema'

export type ParseResult = { ok: true; data: ARResponse } | { ok: false; error: string }

/** Validate untrusted model output (an object or a JSON string) against the AR contract. */
export function parseARResponse(raw: unknown): ParseResult {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'Response is not valid JSON' }
    }
  }

  const result = ARResponseSchema.safeParse(value)
  if (result.success) return { ok: true, data: result.data }

  const [issue] = result.error.issues
  const path = issue.path.length ? issue.path.join('.') : 'response'
  return { ok: false, error: `${path}: ${issue.message}` }
}
