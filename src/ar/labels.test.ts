import { describe, expect, it } from 'vitest'
import { layoutLabels, type LabelRequest } from './labels'
import { overlapArea, segmentIntersectsRect, squareAround } from './layout'

const screen = { width: 400, height: 800 }
const insets = { top: 12, right: 8, bottom: 120, left: 8 }
const label = (id: string, x: number, y: number, extra: Partial<LabelRequest> = {}): LabelRequest => ({
  id,
  anchor: { x, y },
  width: 80,
  height: 20,
  gap: 12,
  ...extra,
})

describe('segmentIntersectsRect', () => {
  const rect = { left: 10, top: 10, width: 10, height: 10 }
  it('detects crossing, containment and misses', () => {
    expect(segmentIntersectsRect({ from: { x: 0, y: 15 }, to: { x: 30, y: 15 } }, rect)).toBe(true)
    expect(segmentIntersectsRect({ from: { x: 12, y: 12 }, to: { x: 14, y: 14 } }, rect)).toBe(true)
    expect(segmentIntersectsRect({ from: { x: 0, y: 0 }, to: { x: 30, y: 5 } }, rect)).toBe(false)
    expect(segmentIntersectsRect({ from: { x: 25, y: 0 }, to: { x: 40, y: 30 } }, rect)).toBe(false)
  })
})

describe('layoutLabels', () => {
  it('places a free label above its point', () => {
    const rect = layoutLabels([label('a', 200, 400)], [], [], screen, insets).get('a')!
    expect(rect.top + rect.height).toBeCloseTo(388)
    expect(rect.left + rect.width / 2).toBeCloseTo(200)
  })

  it('moves labels away from the top edge (the clipped "Sensor OUT" case)', () => {
    const rect = layoutLabels([label('a', 40, 20)], [], [], screen, insets).get('a')!
    expect(rect.top).toBeGreaterThanOrEqual(insets.top)
    expect(rect.left).toBeGreaterThanOrEqual(insets.left)
  })

  it('keeps labels off each other, dots and lines', () => {
    const dots = [squareAround({ x: 200, y: 400 }, 20), squareAround({ x: 210, y: 410 }, 20)]
    const line = { from: { x: 100, y: 380 }, to: { x: 300, y: 380 } }
    const placed = layoutLabels([label('a', 200, 400), label('b', 210, 410)], dots, [line], screen, insets)
    const [a, b] = [placed.get('a')!, placed.get('b')!]
    expect(overlapArea(a, b)).toBe(0)
    for (const dot of dots) {
      expect(overlapArea(a, dot)).toBe(0)
      expect(overlapArea(b, dot)).toBe(0)
    }
    expect(segmentIntersectsRect(line, a)).toBe(false)
    expect(segmentIntersectsRect(line, b)).toBe(false)
  })

  it('honours the preferred direction and centered placement', () => {
    const left = layoutLabels([label('a', 200, 400, { preferred: { x: -1, y: 0 } })], [], [], screen, insets).get('a')!
    expect(left.left + left.width).toBeCloseTo(188)
    const center = layoutLabels([label('c', 200, 400, { allowCenter: true })], [], [], screen, insets).get('c')!
    expect(center.left + center.width / 2).toBeCloseTo(200)
    expect(center.top + center.height / 2).toBeCloseTo(400)
  })
})
