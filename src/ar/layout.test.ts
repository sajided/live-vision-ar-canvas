import { describe, expect, it } from 'vitest'
import { cardWidth, layoutCards, overlapArea, squareAround } from './layout'

const screen = { width: 390, height: 844 }
const options = { width: cardWidth(screen), insets: { top: 64, right: 12, bottom: 128, left: 12 }, offset: 20 }

describe('layoutCards', () => {
  it('places a lone card just below its anchor', () => {
    const rect = layoutCards([{ id: 'a', anchor: { x: 100, y: 200 }, height: 100 }], [], screen, options).get('a')!
    expect(rect.top).toBe(220)
    // Anchor-offset left edge, pulled in so the (wide) card stays inside the right gutter.
    expect(rect.left).toBe(Math.min(80, screen.width - 12 - options.width))
  })

  it('keeps cards with nearby anchors from overlapping each other or beacons', () => {
    // Mirrors the "steps" fixture on a phone.
    const anchors = [
      { x: 117, y: 304 },
      { x: 250, y: 456 },
      { x: 179, y: 608 },
    ]
    const cards = anchors.map((anchor, i) => ({ id: `c${i}`, anchor, height: 104 }))
    const beacons = anchors.map((a) => squareAround(a, 44))
    const placed = [...layoutCards(cards, beacons, screen, options).values()]

    expect(placed).toHaveLength(3)
    for (let i = 0; i < placed.length; i++) {
      for (const beacon of beacons) expect(overlapArea(placed[i], beacon)).toBe(0)
      for (let j = i + 1; j < placed.length; j++) expect(overlapArea(placed[i], placed[j])).toBe(0)
    }
  })

  it('stays inside the insets', () => {
    const rect = layoutCards([{ id: 'a', anchor: { x: 385, y: 830 }, height: 120 }], [], screen, options).get('a')!
    expect(rect.left).toBeGreaterThanOrEqual(12)
    expect(rect.left + rect.width).toBeLessThanOrEqual(screen.width - 12)
    expect(rect.top).toBeGreaterThanOrEqual(64)
    expect(rect.top + rect.height).toBeLessThanOrEqual(screen.height - 128)
  })
})
