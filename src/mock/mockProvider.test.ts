import { describe, expect, it } from 'vitest'
import { contentRectPct, fitIntoSquare } from '../camera/geometry'
import type { AnnotationEvent } from '../ar/events'
import { ARElementSchema } from '../ar/schema'
import { fixtures, type FixtureName } from './fixtures'
import { mockAnnotate, type MockScenario } from './mockProvider'

const rects = {
  portrait: contentRectPct(fitIntoSquare({ width: 390, height: 844 }, 768), 768),
  landscape: contentRectPct(fitIntoSquare({ width: 1600, height: 900 }, 768), 768),
}

async function collect(scenario: MockScenario, rect = rects.portrait, signal?: AbortSignal) {
  const events: AnnotationEvent[] = []
  for await (const e of mockAnnotate(rect, { scenario, signal, latencyMs: 0, gapMs: 0 })) events.push(e)
  return events
}

describe('mockAnnotate', () => {
  for (const [orientation, rect] of Object.entries(rects)) {
    for (const scenario of Object.keys(fixtures) as FixtureName[]) {
      it(`streams valid ${scenario} elements for a ${orientation} frame`, async () => {
        const events = await collect(scenario, rect)
        const elements = events.filter((e) => e.type === 'element')
        expect(elements).toHaveLength(fixtures[scenario].elements.length)
        for (const e of elements) expect(ARElementSchema.safeParse(e.element).success).toBe(true)
        expect(events.at(-1)?.type).toBe('done')
      })
    }
  }

  it('streams elements that fail validation for the invalid scenario', async () => {
    const elements = (await collect('invalid')).filter((e) => e.type === 'element')
    expect(elements.length).toBeGreaterThan(0)
    for (const e of elements) expect(ARElementSchema.safeParse(e.element).success).toBe(false)
  })

  it('ends quietly when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await collect('pinpoint', rects.portrait, controller.signal)).toEqual([])
  })
})
