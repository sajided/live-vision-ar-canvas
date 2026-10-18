import { describe, expect, it } from 'vitest'
import type { ARElement } from './schema'
import { boardShapeOffsets, edgeTimeline, pathLength, traceDuration, traceSeconds, TRACE_SPEED } from './trace'

const tri = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 40 },
]

describe('trace timing', () => {
  it('measures open and closed paths', () => {
    expect(pathLength(tri, false)).toBe(70)
    expect(pathLength(tri, true)).toBe(120)
  })

  it('clamps very short and very long traces', () => {
    expect(traceSeconds(1)).toBe(0.25)
    expect(traceSeconds(10_000)).toBe(3)
    expect(traceSeconds(TRACE_SPEED)).toBe(1)
  })

  it('gives drawn elements a duration and cards none', () => {
    const polygon: ARElement = { id: 'p', type: 'Polygon', points: tri, closed: true, fill: false, color: 'blue' }
    const card: ARElement = { id: 'c', type: 'Formula', position: { x: 1, y: 1 }, latex: 'x' }
    expect(traceDuration(polygon)).toBeCloseTo(1.2)
    expect(traceDuration(card)).toBe(0)
  })

  it('schedules diagram shapes one after another', () => {
    const offsets = boardShapeOffsets([
      { kind: 'segment', from: { x: 0, y: 0 }, to: { x: 50, y: 0 }, variant: 'solid', color: 'blue' },
      { kind: 'point', position: { x: 1, y: 1 }, color: 'blue' },
      { kind: 'label', position: { x: 1, y: 1 }, latex: 'x', color: 'blue' },
    ])
    expect(offsets[0]).toBeCloseTo(0.3)
    expect(offsets[1]).toBeCloseTo(0.8)
    expect(offsets[2]).toBeCloseTo(0.9)
  })

  it('splits time across edges by length', () => {
    const { starts, spans, times } = edgeTimeline([...tri, tri[0]])
    expect(spans).toEqual([0.25, 40 / 120, 50 / 120])
    expect(starts[1]).toBeCloseTo(0.25)
    expect(times).toEqual([0, 0.25, 70 / 120, 1])
  })
})
