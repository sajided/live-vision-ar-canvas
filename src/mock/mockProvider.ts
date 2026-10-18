import { viewportToImage, type PctPoint, type PctRect } from '../camera/geometry'
import type { AnnotationEvent } from '../ar/events'
import type { ARResponseInput } from '../ar/schema'
import { fixtures, invalidFixture, type FixtureName } from './fixtures'

export type MockScenario = FixtureName | 'invalid' | 'random'
export const MOCK_SCENARIOS: MockScenario[] = ['random', 'geometry', 'algebra', 'pinpoint', 'trace', 'steps', 'invalid']

interface MockOptions {
  scenario: MockScenario
  signal?: AbortSignal
  /** Time to first element; defaults to a random 400–900 ms. */
  latencyMs?: number
  /** Gap between streamed elements; defaults to a random 150–300 ms. */
  gapMs?: number
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

type ElementInput = ARResponseInput['elements'][number]

const POINT_KEYS = ['position', 'from', 'to', 'center', 'vertex'] as const

/** Map an element's photo points to image space. Diagram shapes stay in board space. */
function elementToImageSpace(element: ElementInput, contentRect: PctRect): ElementInput {
  const map = (p: PctPoint) => viewportToImage(p, contentRect)
  const out: Record<string, unknown> = { ...element }
  for (const key of POINT_KEYS) {
    if (key in element) out[key] = map(out[key] as PctPoint)
  }
  if (element.type === 'Polygon') out.points = element.points.map(map)
  // Radius is a share of the image side; viewport → image scales by the content width.
  if (element.type === 'Circle') out.radius = (element.radius * contentRect.width) / 100
  return out as ElementInput
}

function toImageSpace(response: ARResponseInput, contentRect: PctRect): ARResponseInput {
  return { ...response, elements: response.elements.map((el) => elementToImageSpace(el, contentRect)) }
}

/** Stand-in for the Gemma backend: streams raw, unvalidated elements like the server would. */
export async function* mockAnnotate(
  contentRect: PctRect,
  { scenario, signal, latencyMs, gapMs }: MockOptions,
): AsyncGenerator<AnnotationEvent> {
  const start = performance.now()
  const names = Object.keys(fixtures) as FixtureName[]
  const name = scenario === 'random' ? names[Math.floor(Math.random() * names.length)] : scenario
  const response =
    name === 'invalid'
      ? (structuredClone(invalidFixture) as { elements: unknown[]; summary?: string })
      : structuredClone(toImageSpace(fixtures[name], contentRect))

  try {
    await delay(latencyMs ?? 400 + Math.random() * 500, signal)
    let firstElementMs: number | null = null
    for (const [i, element] of response.elements.entries()) {
      if (i > 0) await delay(gapMs ?? 150 + Math.random() * 150, signal)
      firstElementMs ??= performance.now() - start
      yield { type: 'element', element }
    }
    yield {
      type: 'done',
      summary: response.summary,
      stats: {
        valid: response.elements.length,
        dropped: 0,
        firstTokenMs: firstElementMs,
        firstElementMs,
        totalMs: performance.now() - start,
        truncated: false,
      },
    }
  } catch {
    // Aborted: end quietly, like a cancelled fetch.
  }
}
