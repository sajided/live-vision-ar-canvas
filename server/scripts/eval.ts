/**
 * Math eval harness: runs labelled problem photos through the real pipeline
 * (Gemma → repair → validation) and reports validity, answer correctness,
 * figure-tracing accuracy and latency by segment.
 *
 *   pnpm gemma:eval [eval/cases.json] [--images <dir>] [--runs <n>] [--pause <ms>]
 *
 * cases.json: [{ "image": "triangle.jpg", "query": "", "expected": ["\\b10\\b"],
 *   "vertices": [{ "x": 23.4, "y": 78.1 }, ...] }]
 * - expected: regexes that must all match the answer (summary, else last Formula)
 * - vertices: the figure's corners in image percent, to score Polygon tracing
 * Variants come from env: GEMMA_MODEL, PROMPT_VARIANT, GEMMA_THINKING_LEVEL.
 */
import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import type { Point } from '../../src/ar/schema'
import type { ARElement } from '../../src/ar/schema'
import { annotateStream } from '../annotate'
import { env } from '../env'
import { streamGemma, type GemmaMeta } from '../gemma'
import { retryBeforeFirstChunk } from '../upstream'

interface EvalCase {
  image: string
  query: string
  expected?: string[]
  vertices?: Point[]
}

interface CaseResult {
  valid: boolean
  correct: boolean | null
  vertexError: number | null
  dropped: number
  truncated: boolean
  firstTokenMs: number | null
  firstElementMs: number | null
  totalMs: number | null
}

const FULL_FRAME = { x: 0, y: 0, width: 100, height: 100 }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

/** Mean distance from each expected corner to the nearest traced point of the best-matching polygon. */
function vertexError(elements: ARElement[], expected: Point[]): number | null {
  const polygons = elements.flatMap((e) => (e.type === 'Polygon' ? [e.points] : []))
  if (!polygons.length) return null
  const errorFor = (points: Point[]) =>
    expected.reduce((sum, v) => sum + Math.min(...points.map((p) => Math.hypot(p.x - v.x, p.y - v.y))), 0) /
    expected.length
  return Math.min(...polygons.map(errorFor))
}

function answerText(summary: string | undefined, elements: ARElement[]): string {
  if (summary) return summary
  const formulas = elements.filter((e) => e.type === 'Formula')
  return formulas.at(-1)?.latex ?? ''
}

async function runCase(c: EvalCase, imageDir: string): Promise<CaseResult & { answer: string; note: string }> {
  const imagePath = resolve(imageDir, c.image)
  const mimeType = extname(imagePath).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg'
  const image = new Uint8Array(await readFile(imagePath))
  const elements: ARElement[] = []
  const meta: GemmaMeta = {}
  const start = performance.now()
  let done: { summary?: string; stats: { dropped: number; truncated: boolean; firstTokenMs: number | null; firstElementMs: number | null; totalMs: number } } | null = null
  let note = ''

  const chunks = retryBeforeFirstChunk(
    () => streamGemma({ image, mimeType, query: c.query, contentRect: FULL_FRAME, meta }),
    { retries: 1, delayMs: 800 },
  )
  for await (const event of annotateStream(chunks, { start, meta })) {
    if (event.type === 'element') elements.push(event.element as ARElement)
    else if (event.type === 'done') done = event
    else note = `${event.code}: ${event.message}`
  }

  const answer = answerText(done?.summary, elements)
  const correct = c.expected?.length ? c.expected.every((re) => new RegExp(re, 'i').test(answer)) : null
  return {
    valid: done !== null,
    correct,
    vertexError: c.vertices ? vertexError(elements, c.vertices) : null,
    dropped: done?.stats.dropped ?? 0,
    truncated: done?.stats.truncated ?? false,
    firstTokenMs: done?.stats.firstTokenMs ?? null,
    firstElementMs: done?.stats.firstElementMs ?? null,
    totalMs: done?.stats.totalMs ?? null,
    answer,
    note,
  }
}

async function main() {
  const casesPath = resolve(process.argv[2]?.startsWith('--') ? 'eval/cases.json' : (process.argv[2] ?? 'eval/cases.json'))
  const imageDir = resolve(arg('images') ?? dirname(casesPath) + '/images')
  const runs = Number(arg('runs') ?? 1)
  // Space requests out to stay under the API's per-minute quota.
  const pauseMs = Number(arg('pause') ?? 0)
  const cases = JSON.parse(await readFile(casesPath, 'utf8')) as EvalCase[]
  console.log(
    `model=${env.GEMMA_MODEL} prompt=${env.PROMPT_VARIANT} thinking=${env.GEMMA_THINKING_LEVEL} ` +
      `images=${imageDir} cases=${cases.length} runs=${runs}\n`,
  )

  const results: CaseResult[] = []
  for (let run = 0; run < runs; run++) {
    for (const c of cases) {
      if (results.length && pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs))
      const r = await runCase(c, imageDir)
      results.push(r)
      const mark = r.correct === null ? '    ' : r.correct ? 'OK  ' : 'FAIL'
      const vtx = r.vertexError === null ? '' : ` corners±${r.vertexError.toFixed(1)}%`
      const t = (v: number | null) => (v === null ? '–' : `${(v / 1000).toFixed(1)}s`)
      console.log(
        `${mark} ${c.image.padEnd(16)} token ${t(r.firstTokenMs)} elem ${t(r.firstElementMs)} total ${t(r.totalMs)}` +
          `${vtx}${r.truncated ? ' CUT' : ''}${r.dropped ? ` dropped=${r.dropped}` : ''} | ${r.note || r.answer.slice(0, 70)}`,
      )
    }
  }

  const n = results.length
  const pct = (k: number, d: number) => (d ? `${((k / d) * 100).toFixed(0)}%` : '–')
  const scored = results.filter((r) => r.correct !== null)
  const vertexErrors = results.flatMap((r) => (r.vertexError === null ? [] : [r.vertexError]))
  const series = (key: 'firstTokenMs' | 'firstElementMs' | 'totalMs') =>
    results.flatMap((r) => (r[key] === null ? [] : [r[key] as number]))
  const p = (key: 'firstTokenMs' | 'firstElementMs' | 'totalMs') =>
    `p50 ${percentile(series(key), 50).toFixed(0)} / p95 ${percentile(series(key), 95).toFixed(0)} ms`

  console.log('\nSUMMARY')
  console.log(`  valid answers:   ${results.filter((r) => r.valid).length}/${n} (${pct(results.filter((r) => r.valid).length, n)}, KPI >98%)`)
  console.log(`  correct answers: ${scored.filter((r) => r.correct).length}/${scored.length} (${pct(scored.filter((r) => r.correct).length, scored.length)})`)
  console.log(`  cut off:         ${results.filter((r) => r.truncated).length}/${n}, dropped elements ${results.reduce((s, r) => s + r.dropped, 0)}`)
  console.log(`  corner error:    ${vertexErrors.length ? `mean ${(vertexErrors.reduce((a, b) => a + b, 0) / vertexErrors.length).toFixed(1)}% of image` : '–'}`)
  console.log(`  first token:     ${p('firstTokenMs')}`)
  console.log(`  first element:   ${p('firstElementMs')}  (KPI <2500)`)
  console.log(`  total:           ${p('totalMs')}`)
}

void main()
