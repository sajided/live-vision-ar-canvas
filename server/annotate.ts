import katex from 'katex'
import { ARElementSchema, type ARElement } from '../src/ar/schema'
import type { AnnotationEvent } from '../src/ar/events'
import type { GemmaMeta } from './gemma'
import { upstreamErrorEvent } from './upstream'
import { ElementStreamParser } from './elementStream'
import { MODEL_GRID } from './prompt'

const MAX_ELEMENTS = 24
const MAX_ID_LENGTH = 40
const MAX_SUMMARY_LENGTH = 200
// Small overshoots past the grid edge are clamped instead of rejected.
const GRID_TOLERANCE = 12

const POINT_KEYS = ['position', 'from', 'to', 'center', 'vertex'] as const
const KATEX_ERROR_COLOR = '#cc0000'

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { x?: unknown }).x === 'number' &&
    typeof (value as { y?: unknown }).y === 'number'
  )
}

function gridToPct(value: number): number {
  if (value < -GRID_TOLERANCE || value > MODEL_GRID + GRID_TOLERANCE) return value // let validation reject it
  const clamped = Math.min(Math.max(value, 0), MODEL_GRID)
  return Math.round((clamped / MODEL_GRID) * 1000) / 10
}

const toPct = (point: { x: number; y: number }) => ({ x: gridToPct(point.x), y: gridToPct(point.y) })

/**
 * Convert an element's coordinates from the model's 0–1000 grid to the 0–100
 * contract: named points, point lists, radii and nested diagram shapes.
 */
export function fromModelGrid(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const element: Record<string, unknown> = { ...raw }
  for (const key of POINT_KEYS) {
    const point = element[key]
    if (isPoint(point)) element[key] = toPct(point)
  }
  if (Array.isArray(element.points)) element.points = element.points.map((p) => (isPoint(p) ? toPct(p) : p))
  if (typeof element.radius === 'number') element.radius = Math.round((element.radius / MODEL_GRID) * 1000) / 10
  if (Array.isArray(element.shapes)) element.shapes = element.shapes.map(fromModelGrid)
  return element
}

// JSON escapes that a single-backslash LaTeX command collides with (\text → TAB + "ext").
const CONTROL_TO_COMMAND: Record<string, string> = { '\t': '\\t', '\f': '\\f', '\b': '\\b', '\r': '\\r', '\n': '\\n' }

/** Double backslashes that aren't valid JSON escapes (e.g. \sqrt), so the element still parses. */
export function repairJsonEscapes(json: string): string {
  // \u is only valid with 4 hex digits; \underline etc. must be doubled too.
  return json.replace(/\\(\\|["/bfnrt]|u[0-9a-fA-F]{4})|\\/g, (match, escape: string | undefined) =>
    escape ? match : '\\\\',
  )
}

/** Undo control characters from single-backslash commands and close unbalanced braces. */
export function repairLatex(latex: string): string {
  let out = latex.replace(/[\t\f\b\r\n]/g, (ch) => CONTROL_TO_COMMAND[ch])
  const open = (out.match(/(?<!\\)\{/g) ?? []).length - (out.match(/(?<!\\)\}/g) ?? []).length
  if (open > 0) out += '}'.repeat(open)
  return out
}

/** Apply {@link repairLatex} to every LaTeX field of a raw element. */
export function repairLatexFields(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const element: Record<string, unknown> = { ...raw }
  if (typeof element.latex === 'string') element.latex = repairLatex(element.latex)
  // Only a Diagram's caption is LaTeX; other captions are plain text.
  if (element.type === 'Diagram' && typeof element.caption === 'string') element.caption = repairLatex(element.caption)
  if (Array.isArray(element.shapes)) element.shapes = element.shapes.map(repairLatexFields)
  return element
}

// Multi-letter words that are ordinary math, not prose.
const MATH_WORDS = new Set(
  'sin cos tan cot sec csc sinh cosh tanh arcsin arccos arctan log ln exp lim max min det gcd lcm mod arg deg dim ker sup inf'.split(' '),
)
const PROSE_MIN_WORDS = 4

/** Whether a "formula" is really a sentence (which KaTeX would render as squashed italics). */
export function looksLikeProse(latex: string): boolean {
  const words = latex.replace(/\\[a-zA-Z]+/g, ' ').match(/[A-Za-z]{3,}/g) ?? []
  return words.filter((w) => !MATH_WORDS.has(w.toLowerCase())).length >= PROSE_MIN_WORDS
}

/** Best-effort plain text from LaTeX prose. */
export function latexToPlainText(latex: string): string {
  return latex
    .replace(/\\(?:text|mathrm|textbf|textit|mathit|operatorname)\s*\{([^}]*)\}/g, '$1')
    .replace(/\\\\|\\[,;:! ]/g, ' ')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}$]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Turn a Formula that holds a sentence into an InfoCard so it reads naturally. */
export function proseFormulaToCard(element: ARElement): ARElement {
  if (element.type !== 'Formula' || !looksLikeProse(element.latex)) return element
  return {
    id: element.id,
    type: 'InfoCard',
    position: element.position,
    title: (element.caption ?? 'Explanation').slice(0, 60),
    body: latexToPlainText(element.latex).slice(0, 280) || element.latex.slice(0, 280),
    ...(element.stepIndex !== undefined && { stepIndex: element.stepIndex }),
  }
}

function latexOf(element: ARElement): string[] {
  switch (element.type) {
    case 'Formula':
    case 'MathLabel':
      return [element.latex]
    case 'Diagram':
      return [
        ...(element.caption ? [element.caption] : []),
        ...element.shapes.flatMap((s) => (s.kind === 'label' ? [s.latex] : [])),
      ]
    default:
      return []
  }
}

/** First LaTeX string KaTeX can't parse, if any; such elements would render as red error text. */
export function invalidLatex(element: ARElement): string | null {
  for (const latex of latexOf(element)) {
    try {
      const html = katex.renderToString(latex, { throwOnError: true, strict: 'ignore', trust: false, maxExpand: 200 })
      // Untrusted commands (\href, \url, ...) don't throw; KaTeX prints them in its error color instead.
      if (html.includes(KATEX_ERROR_COLOR)) return latex
    } catch {
      return latex
    }
  }
  return null
}

interface AnnotateOptions {
  signal?: AbortSignal
  /** performance.now() at request start, for timings. */
  start?: number
  /** Model metadata gathered while streaming (first token, finish reason). */
  meta?: GemmaMeta
}

/**
 * Turn streamed model text into validated element events. Invalid elements
 * are dropped (and counted) rather than failing the whole answer.
 */
export async function* annotateStream(
  chunks: AsyncIterable<string>,
  { signal, start = performance.now(), meta = {} }: AnnotateOptions = {},
): AsyncGenerator<AnnotationEvent> {
  const parser = new ElementStreamParser()
  const ids = new Set<string>()
  let valid = 0
  let dropped = 0
  let firstElementMs: number | null = null

  // Validates one extracted element JSON string; returns the event to emit, if any.
  const accept = (json: string): AnnotationEvent | null => {
    let raw: unknown
    try {
      raw = JSON.parse(repairJsonEscapes(json))
    } catch {
      dropped++
      return null
    }
    const result = ARElementSchema.safeParse(fromModelGrid(repairLatexFields(raw)))
    if (!result.success || valid >= MAX_ELEMENTS) {
      if (!result.success) console.warn(`[annotate] dropped element: ${result.error.issues[0].message}`)
      dropped++
      return null
    }

    const element = proseFormulaToCard(result.data)
    const badLatex = invalidLatex(element)
    if (badLatex !== null) {
      console.warn(`[annotate] dropped element with invalid LaTeX: ${badLatex}`)
      dropped++
      return null
    }
    let id = element.id
    for (let n = 2; ids.has(id); n++) id = `${element.id.slice(0, MAX_ID_LENGTH - 4)}-${n}`
    ids.add(id)

    valid++
    firstElementMs ??= performance.now() - start
    return { type: 'element', element: { ...element, id } }
  }

  try {
    for await (const chunk of chunks) {
      for (const json of parser.push(chunk)) {
        const event = accept(json)
        if (event) yield event
      }
    }
    for (const json of parser.flush()) {
      const event = accept(json)
      if (event) yield event
    }
  } catch (err) {
    if (signal?.aborted && signal.reason?.name !== 'TimeoutError') return
    const timedOut = signal?.reason?.name === 'TimeoutError'
    console.error('[annotate] upstream error:', err instanceof Error ? err.message : err)
    yield timedOut
      ? { type: 'error', code: 'timeout', message: 'The model took too long to answer.', retryable: true }
      : upstreamErrorEvent(err)
    return
  }

  if (valid === 0) {
    yield { type: 'error', code: 'invalid', message: "Couldn't read the answer — try again", retryable: true }
    return
  }

  const truncated = !parser.complete || meta.finishReason === 'MAX_TOKENS'
  if (truncated) console.warn(`[annotate] answer cut off (finishReason ${meta.finishReason ?? 'unknown'})`)
  yield {
    type: 'done',
    summary: parser.summary?.slice(0, MAX_SUMMARY_LENGTH),
    stats: {
      valid,
      dropped,
      firstTokenMs: meta.firstTokenAt !== undefined ? meta.firstTokenAt - start : null,
      firstElementMs,
      totalMs: performance.now() - start,
      truncated,
      ...(meta.finishReason && { finishReason: meta.finishReason }),
    },
  }
}
